import OpenAI from "openai";

const GEMINI_OPENAI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/";

export function getLlmModel() {
  return process.env.GEMINI_MODEL || "gemini-3.6-flash";
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

export async function completeLlmChat(options: {
  system: string;
  user: string;
  temperature?: number;
  json?: boolean;
  maxTokens?: number;
}) {
  const client = getLlmClient();
  const maxTokens = options.maxTokens ?? 2048;
  const completion = await client.chat.completions.create({
    model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
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

export const getXaiModel = getLlmModel;
export const getXaiClient = getLlmClient;
export const completeXaiChat = completeLlmChat;
