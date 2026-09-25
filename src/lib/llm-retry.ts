/**
 * Retry policy for transient Gemini failures ("model is overloaded", 503
 * UNAVAILABLE, 429 per-minute limits, 500/502/504, dropped sockets).
 *
 * Pure module (no SDK imports) so it can be unit-tested with `node --test`.
 * `src/lib/llm.ts` wires it around every chat completion.
 */

export type TransientLlmErrorKind = "busy" | "rate_limit" | "server" | "network";

/** Total tries per model, including the first call. */
export const LLM_RETRY_MAX_ATTEMPTS = 4;
/** Base waits before retry 1, 2, 3 (jittered ±25%). */
export const LLM_RETRY_BASE_DELAYS_MS: readonly number[] = [2_000, 5_000, 12_000];
/** A server-provided Retry-After / retryDelay longer than this is not worth waiting for. */
export const LLM_RETRY_MAX_HINT_MS = 30_000;
/** Do not start a retry unless at least this much budget remains after the wait. */
export const LLM_RETRY_MIN_CALL_MS = 20_000;

const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404]);
const SERVER_STATUSES = new Set([500, 502, 504]);
const NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNABORTED",
  "ETIMEDOUT",
  "EPIPE",
  "EAI_AGAIN",
  "ENOTFOUND",
  "ECONNREFUSED",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

export function llmErrorStatus(err: unknown): number | undefined {
  const status = asRecord(err)?.status;
  return typeof status === "number" ? status : undefined;
}

function safeJson(value: unknown): string {
  if (value === undefined) return "";
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}

/** Message + provider error body + cause, flattened for pattern checks. */
export function llmErrorText(err: unknown): string {
  const record = asRecord(err);
  const message = err instanceof Error ? err.message : String(err);
  const cause = asRecord(record?.cause);
  const causeText = cause
    ? `${typeof cause.message === "string" ? cause.message : ""} ${
        typeof cause.code === "string" ? cause.code : ""
      }`
    : "";
  return `${message} ${safeJson(record?.error)} ${causeText}`.trim();
}

function errorCodes(err: unknown): string[] {
  const codes: string[] = [];
  let current: unknown = err;
  for (let depth = 0; depth < 4 && current; depth++) {
    const code = asRecord(current)?.code;
    if (typeof code === "string") codes.push(code);
    current = asRecord(current)?.cause;
  }
  return codes;
}

/**
 * Daily quota: waiting seconds will not help, so don't retry. (Per-minute and
 * daily 429s share the "check your plan and billing details" wording, so only
 * the quota id / "per day" text distinguishes them.)
 */
export function isHardQuotaError(err: unknown): boolean {
  return /PerDay|per day|daily/i.test(llmErrorText(err));
}

function isSafetyBlock(text: string): boolean {
  return /\bSAFETY\b|content_filter|blocked due to|PROHIBITED_CONTENT|blockReason/i.test(text);
}

/**
 * Returns the transient class of an LLM error, or null when retrying cannot
 * help (400/401/403/404, safety blocks, empty completions, daily quota).
 */
export function classifyTransientLlmError(err: unknown): TransientLlmErrorKind | null {
  const status = llmErrorStatus(err);
  const text = llmErrorText(err);

  if (status !== undefined && NON_RETRYABLE_STATUSES.has(status)) return null;
  if (isSafetyBlock(text)) return null;

  if (status === 503) return "busy";
  if (status === 429) return isHardQuotaError(err) ? null : "rate_limit";
  if (status !== undefined && SERVER_STATUSES.has(status)) return "server";
  if (status !== undefined) return null;

  if (errorCodes(err).some((code) => NETWORK_CODES.has(code))) return "network";
  if (/(?:^|\D)503(?:\D|$)|\bUNAVAILABLE\b|overloaded|high demand|try again later/i.test(text)) {
    return "busy";
  }
  if (/(?:^|\D)429(?:\D|$)|RESOURCE_EXHAUSTED|rate limit/i.test(text)) {
    return isHardQuotaError(err) ? null : "rate_limit";
  }
  if (/(?:^|\D)50[024](?:\D|$)|\bINTERNAL\b|DEADLINE_EXCEEDED|Bad Gateway|Gateway Timeout/.test(text)) {
    return "server";
  }
  if (
    /socket hang up|fetch failed|network error|Connection error|Request timed out|ECONNRESET|ETIMEDOUT/i.test(
      text,
    )
  ) {
    return "network";
  }
  return null;
}

function headerValue(err: unknown, name: string): string | undefined {
  const headers = asRecord(err)?.headers;
  if (!headers) return undefined;
  if (typeof (headers as { get?: unknown }).get === "function") {
    const value = (headers as { get(key: string): string | null }).get(name);
    return value ?? undefined;
  }
  const value = (headers as Record<string, unknown>)[name];
  return typeof value === "string" ? value : undefined;
}

/** Server hint from `retry-after-ms`, `Retry-After`, Gemini `retryDelay`, or "retry in 12.3s". */
export function llmRetryAfterMs(err: unknown, now = Date.now()): number | undefined {
  const retryAfterMs = headerValue(err, "retry-after-ms");
  if (retryAfterMs !== undefined) {
    const ms = Number(retryAfterMs);
    if (Number.isFinite(ms) && ms >= 0) return Math.round(ms);
  }

  const retryAfter = headerValue(err, "retry-after");
  if (retryAfter !== undefined) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(0, date - now);
  }

  const text = llmErrorText(err);
  const delay =
    text.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/) ??
    text.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
  if (delay) return Math.round(Number(delay[1]) * 1000);
  return undefined;
}

/** Exponential backoff with ±25% jitter. `retryIndex` is 0 for the first retry. */
export function llmBackoffMs(retryIndex: number, random: () => number = Math.random): number {
  const bases = LLM_RETRY_BASE_DELAYS_MS;
  const base = bases[Math.min(retryIndex, bases.length - 1)] ?? 2_000;
  return Math.round(base * (0.75 + random() * 0.5));
}

export type LlmRetryOptions = {
  label: string;
  maxAttempts?: number;
  /** Epoch ms after which no new attempt may start (route time budget). */
  deadline?: number;
  minCallMs?: number;
  classify?: (err: unknown) => TransientLlmErrorKind | null;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  log?: (message: string) => void;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs `fn` and retries transient failures with exponential backoff + jitter,
 * honoring server retry hints, never sleeping past `deadline - minCallMs`.
 * Rethrows the last error when attempts or budget run out.
 */
export async function withLlmRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: LlmRetryOptions,
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? LLM_RETRY_MAX_ATTEMPTS);
  const minCallMs = options.minCallMs ?? LLM_RETRY_MIN_CALL_MS;
  const classify = options.classify ?? classifyTransientLlmError;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const log = options.log ?? ((message: string) => console.warn(message));

  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      const kind = classify(err);
      if (!kind || attempt >= maxAttempts) throw err;

      const status = llmErrorStatus(err) ?? kind;
      const hint = llmRetryAfterMs(err, now());
      if (hint !== undefined && hint > LLM_RETRY_MAX_HINT_MS) {
        log(
          `[llm] ${options.label} ${status} attempt ${attempt}/${maxAttempts}; server asks to wait ${Math.round(hint / 1000)}s, not retrying`,
        );
        throw err;
      }
      const delay = Math.max(hint ?? 0, llmBackoffMs(attempt - 1, options.random));
      if (options.deadline !== undefined && now() + delay + minCallMs > options.deadline) {
        log(
          `[llm] ${options.label} ${status} attempt ${attempt}/${maxAttempts}; time budget too low to retry`,
        );
        throw err;
      }

      log(
        `[llm] ${options.label} ${status} attempt ${attempt}/${maxAttempts}; retrying in ${(delay / 1000).toFixed(1)}s`,
      );
      await sleep(delay);
    }
  }
}
