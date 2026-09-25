import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyTransientLlmError,
  llmBackoffMs,
  llmRetryAfterMs,
  withLlmRetry,
} from "./llm-retry.ts";

function apiError(status: number | undefined, message: string, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(message), { status, ...extra });
}

describe("classifyTransientLlmError", () => {
  it("retries Gemini busy / overloaded responses", () => {
    assert.equal(
      classifyTransientLlmError(apiError(503, "503 This model is currently experiencing high demand.")),
      "busy",
    );
    assert.equal(classifyTransientLlmError(new Error("The model is overloaded. Please try again later.")), "busy");
    assert.equal(classifyTransientLlmError(new Error('{"status":"UNAVAILABLE"}')), "busy");
  });

  it("retries transient 5xx, per-minute 429 and dropped sockets", () => {
    assert.equal(classifyTransientLlmError(apiError(500, "500 Internal error")), "server");
    assert.equal(classifyTransientLlmError(apiError(502, "502 Bad Gateway")), "server");
    assert.equal(classifyTransientLlmError(apiError(504, "504 DEADLINE_EXCEEDED")), "server");
    assert.equal(classifyTransientLlmError(apiError(429, "429 RESOURCE_EXHAUSTED")), "rate_limit");
    const reset = Object.assign(new Error("Connection error."), {
      cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }),
    });
    assert.equal(classifyTransientLlmError(reset), "network");
  });

  it("does not retry client errors, safety blocks, empty completions or daily quota", () => {
    for (const status of [400, 401, 403, 404]) {
      assert.equal(classifyTransientLlmError(apiError(status, `${status} overloaded`)), null);
    }
    assert.equal(classifyTransientLlmError(new Error("Response blocked due to SAFETY")), null);
    assert.equal(classifyTransientLlmError(new Error("Gemini returned an empty completion")), null);
    assert.equal(
      classifyTransientLlmError(
        apiError(429, "429 quota exceeded", {
          error: { details: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] },
        }),
      ),
      null,
    );
  });
});

describe("llmRetryAfterMs", () => {
  it("reads Retry-After headers and Gemini retryDelay", () => {
    assert.equal(llmRetryAfterMs(apiError(429, "x", { headers: new Headers({ "retry-after": "7" }) })), 7000);
    assert.equal(llmRetryAfterMs(apiError(429, "x", { headers: { "retry-after-ms": "1500" } })), 1500);
    assert.equal(
      llmRetryAfterMs(apiError(429, "x", { error: { details: [{ retryDelay: "12s" }] } })),
      12000,
    );
    assert.equal(llmRetryAfterMs(new Error("Please retry in 3.5s.")), 3500);
    assert.equal(llmRetryAfterMs(new Error("no hint")), undefined);
  });
});

describe("llmBackoffMs", () => {
  it("grows 2s → 5s → 12s with ±25% jitter", () => {
    assert.equal(llmBackoffMs(0, () => 0.5), 2000);
    assert.equal(llmBackoffMs(1, () => 0.5), 5000);
    assert.equal(llmBackoffMs(2, () => 0.5), 12000);
    assert.equal(llmBackoffMs(0, () => 0), 1500);
    assert.equal(llmBackoffMs(2, () => 1), 15000);
  });
});

describe("withLlmRetry", () => {
  function harness() {
    let clock = 0;
    const sleeps: number[] = [];
    const logs: string[] = [];
    return {
      sleeps,
      logs,
      now: () => clock,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        clock += ms;
      },
      log: (message: string) => logs.push(message),
      random: () => 0.5,
    };
  }

  it("retries busy errors with backoff and then succeeds", async () => {
    const h = harness();
    let calls = 0;
    const result = await withLlmRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw apiError(503, "503 high demand");
        return "ok";
      },
      { label: "m", ...h },
    );
    assert.equal(result, "ok");
    assert.equal(calls, 3);
    assert.deepEqual(h.sleeps, [2000, 5000]);
    assert.match(h.logs[0] ?? "", /m 503 attempt 1\/4; retrying in 2\.0s/);
  });

  it("gives up after 4 attempts total", async () => {
    const h = harness();
    let calls = 0;
    await assert.rejects(
      withLlmRetry(
        async () => {
          calls += 1;
          throw apiError(503, "503 overloaded");
        },
        { label: "m", ...h },
      ),
      /overloaded/,
    );
    assert.equal(calls, 4);
    assert.deepEqual(h.sleeps, [2000, 5000, 12000]);
  });

  it("never retries a 400", async () => {
    const h = harness();
    let calls = 0;
    await assert.rejects(
      withLlmRetry(
        async () => {
          calls += 1;
          throw apiError(400, "400 bad request");
        },
        { label: "m", ...h },
      ),
    );
    assert.equal(calls, 1);
    assert.deepEqual(h.sleeps, []);
  });

  it("honors a longer Retry-After hint", async () => {
    const h = harness();
    let calls = 0;
    await withLlmRetry(
      async () => {
        calls += 1;
        if (calls === 1) throw apiError(429, "429", { headers: { "retry-after": "9" } });
        return "ok";
      },
      { label: "m", ...h },
    );
    assert.deepEqual(h.sleeps, [9000]);
  });

  it("does not wait for hints beyond the cap", async () => {
    const h = harness();
    let calls = 0;
    await assert.rejects(
      withLlmRetry(
        async () => {
          calls += 1;
          throw apiError(429, "429 Please retry in 45s.");
        },
        { label: "m", ...h },
      ),
    );
    assert.equal(calls, 1);
  });

  it("stops retrying when the next wait would overrun the deadline", async () => {
    const h = harness();
    let calls = 0;
    await assert.rejects(
      withLlmRetry(
        async () => {
          calls += 1;
          throw apiError(503, "503");
        },
        // The 2s and 5s waits leave 20s for a call before the 30s deadline; the 12s wait does not.
        { label: "m", deadline: 30_000, minCallMs: 20_000, ...h },
      ),
    );
    assert.equal(calls, 3);
    assert.deepEqual(h.sleeps, [2000, 5000]);
    assert.match(h.logs.at(-1) ?? "", /time budget too low/);
  });
});
