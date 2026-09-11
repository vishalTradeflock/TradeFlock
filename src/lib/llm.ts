import OpenAI from "openai";

const GEMINI_OPENAI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/";

const DEFAULT_MODEL = "gemini-3.6-flash";
const DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";

const exhaustedAt = new Map<string, number>();
const EXHAUST_TTL_MS = 60 * 60 * 1000;

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
  const completion = await client.chat.completions.create({
    model,
    temperature: options.temperature ?? 0.4,
    max_tokens: maxTokens,
    ...(options.json ? { response_format: { type: "json_object" as const } } : {}),
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: options.user },
    ],
  });

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

  for (const model of models) {
    attempted.push(model);
    try {
      return await completeOnce(model, options);
    } catch (err) {
      lastError = err;
      if (!isRateLimitError(err)) {
        throw err;
      }
      exhaustedAt.set(model, Date.now());
      const next = models[attempted.length];
      console.warn(
        `[llm] ${model} quota exhausted${next ? `; falling back to ${next}` : ""}`,
      );
    }
  }

  if (isRateLimitError(lastError)) {
    throw new LlmQuotaError(attempted);
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini request failed");
}

export const getXaiModel = getLlmModel;
export const getXaiClient = getLlmClient;
export const completeXaiChat = completeLlmChat;
