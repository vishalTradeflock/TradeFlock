const TOKEN = /^[a-zA-Z0-9_-]{8,128}$/;

export function sanitizeVerificationToken(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const fromMeta = trimmed.match(/content\s*=\s*["']([^"']+)["']/i)?.[1]?.trim() ?? trimmed;
  if (!TOKEN.test(fromMeta)) return null;
  return fromMeta;
}

export const ALT_TEXT_MAX = 250;
export const BIO_MAX = 1_200;

export function sanitizeAltText(value: string | null | undefined) {
  const trimmed = (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return trimmed.slice(0, ALT_TEXT_MAX);
}

export function sanitizeBio(value: string | null | undefined) {
  const trimmed = (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return trimmed.slice(0, BIO_MAX);
}
