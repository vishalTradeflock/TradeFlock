import { AsyncLocalStorage } from "node:async_hooks";
import OpenAI, { APIConnectionError } from "openai";
import {
  classifyTransientLlmError,
  withLlmRetry,
  type TransientLlmErrorKind,
} from "@/lib/llm-retry";

const GEMINI_OPENAI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/";

const DEFAULT_MODEL = "gemini-3.6-flash";
const DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";

const exhaustedAt = new Map<string, number>();
const EXHAUST_TTL_MS = 60 * 60 * 1000;
/** Never start a Gemini request with less than this much route budget left. */
const LLM_MIN_REQUEST_MS = 5_000;

/**
 * Per-request time budget. The cron route sets a deadline below its Vercel
 * maxDuration so retries, backoff waits and request timeouts can never run
 * the function past its limit. Scripts that run outside a budget get none.
 */
const llmBudget = new AsyncLocalStorage<{ deadline: number }>();

export function runWithLlmDeadline<T>(deadline: number, fn: () => Promise<T>): Promise<T> {
  return llmBudget.run({ deadline }, fn);
}

function llmDeadline(): number | undefined {
  return llmBudget.getStore()?.deadline;
}

/** Milliseconds left in the current LLM budget (Infinity outside a budget). */
export function llmTimeRemainingMs(): number {
  const deadline = llmDeadline();
  return deadline === undefined ? Number.POSITIVE_INFINITY : deadline - Date.now();
}

export class LlmQuotaError extends Error {
  readonly code = "LLM_QUOTA_EXHAUSTED" as const;
  readonly models: string[];

  constructor(models: string[]) {
    super(
      models.length > 0
        ? `Gemini quota exhausted (${models.join(" → ")}).`
        : "Gemini quota exhausted.",
    );
    this.name = "LlmQuotaError";
    this.models = models;
  }
}

export function isLlmQuotaError(err: unknown): err is LlmQuotaError {
  return err instanceof LlmQuotaError;
}

/** Gemini stayed busy/overloaded (503, 5xx, network) after retries and fallback. */
export class LlmUnavailableError extends Error {
  readonly code = "LLM_UNAVAILABLE" as const;
  readonly models: string[];

  constructor(models: string[], cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(
      `Gemini unavailable after retries${models.length ? ` (${models.join(" → ")})` : ""}: ${detail}`,
    );
    this.name = "LlmUnavailableError";
    this.models = models;
  }
}

export function isLlmUnavailableError(err: unknown): err is LlmUnavailableError {
  return err instanceof LlmUnavailableError;
}

function classifyLlmError(err: unknown): TransientLlmErrorKind | null {
  if (err instanceof APIConnectionError) return "network";
  return classifyTransientLlmError(err);
}

export function getLlmModel() {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

export function getLlmFallbackModel(): string | undefined {
  if (process.env.GEMINI_FALLBACK_MODEL === undefined) return DEFAULT_FALLBACK_MODEL;
  const trimmed = process.env.GEMINI_FALLBACK_MODEL.trim();
  return trimmed || undefined;
}

function isModelExhausted(model: string): boolean {
  const at = exhaustedAt.get(model);
  if (at === undefined) return false;
  if (Date.now() - at > EXHAUST_TTL_MS) {
    exhaustedAt.delete(model);
    return false;
  }
  return true;
}

function modelsToAttempt(): string[] {
  const primary = getLlmModel();
  const fallback = getLlmFallbackModel();
  const ordered = fallback && fallback !== primary ? [primary, fallback] : [primary];
  return ordered.filter((model) => !isModelExhausted(model));
}

function errorStatus(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null && "status" in err) {
    const status = (err as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function isRateLimitError(err: unknown): boolean {
  if (errorStatus(err) === 429) return true;
  return /(?:^|\D)429(?:\D|$)|RESOURCE_EXHAUSTED|exceeded your current quota/i.test(
    errorText(err),
  );
}

export function getLlmClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  return new OpenAI({
    apiKey,
    baseURL: GEMINI_OPENAI_BASE_URL,
    // Retries are handled by withLlmRetry (longer backoff, budget-aware);
    // the SDK's own 2 quick retries would hide attempts from the time budget.
    maxRetries: 0,
  });
}

async function completeOnce(
  model: string,
  options: {
    system: string;
    user: string;
    temperature?: number;
    json?: boolean;
    maxTokens?: number;
  },
) {
  const client = getLlmClient();
  const maxTokens = options.maxTokens ?? 2048;
  const remaining = llmTimeRemainingMs();
  const completion = await client.chat.completions.create(
    {
      model,
      temperature: options.temperature ?? 0.4,
      max_tokens: maxTokens,
      ...(options.json ? { response_format: { type: "json_object" as const } } : {}),
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user },
      ],
    },
    // Inside a route budget, a hung request is cut off at the deadline.
    Number.isFinite(remaining) ? { timeout: Math.max(LLM_MIN_REQUEST_MS, remaining) } : undefined,
  );

  const text = completion.choices[0]?.message.content?.trim();
  if (!text) {
    throw new Error("Gemini returned an empty completion");
  }

  return text;
}

export async function completeLlmChat(options: {
  system: string;
  user: string;
  temperature?: number;
  json?: boolean;
  maxTokens?: number;
}) {
  const attempted: string[] = [];
  const models = modelsToAttempt();

  if (models.length === 0) {
    throw new LlmQuotaError([...exhaustedAt.keys()]);
  }

  let lastError: unknown;
  const deadline = llmDeadline();

  for (const model of models) {
    if (deadline !== undefined && deadline - Date.now() < LLM_MIN_REQUEST_MS) {
      console.warn(`[llm] time budget exhausted; not calling ${model}`);
      break;
    }
    attempted.push(model);
    try {
      // Busy/overloaded errors are retried on this model before falling back.
      return await withLlmRetry(() => completeOnce(model, options), {
        label: model,
        deadline,
        classify: classifyLlmError,
      });
    } catch (err) {
      lastError = err;
      const next = models[attempted.length];
      if (isRateLimitError(err)) {
        exhaustedAt.set(model, Date.now());
        console.warn(
          `[llm] ${model} quota exhausted${next ? `; falling back to ${next}` : ""}`,
        );
        continue;
      }
      if (classifyLlmError(err)) {
        // Busy is not quota: don't mark the model exhausted for an hour.
        console.warn(
          `[llm] ${model} still unavailable after retries${next ? `; falling back to ${next}` : ""}`,
        );
        continue;
      }
      throw err;
    }
  }

  if (lastError !== undefined && isRateLimitError(lastError)) {
    throw new LlmQuotaError(attempted);
  }

  if (lastError === undefined || classifyLlmError(lastError)) {
    throw new LlmUnavailableError(attempted, lastError ?? "route time budget exhausted");
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini request failed");
}

export const getXaiModel = getLlmModel;
export const getXaiClient = getLlmClient;
export const completeXaiChat = completeLlmChat;
