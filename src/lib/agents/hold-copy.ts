/** Drafts are stamped a year ahead so public queries (`published_at <= now`) hide them. */
export const HOLD_PUBLISHED_AT_OFFSET_MS = 365 * 24 * 60 * 60 * 1000;

const HOLD_NOTE_RE = /<!--\s*tradeflock-hold:[\s\S]*?-->/gi;

const FAILURE_PREFIX =
  /(?:^|;\s*)(?:too_short\b|title:|slug:|headings:|voice:|source:|figures:|dates:|links:|formula-empty\b|dateline\b|invented observers|unsupported allocator|synthetic market-brief|body is missing|source notes are missing)/i;

export function holdPublishedAt(now = Date.now()): string {
  return new Date(now + HOLD_PUBLISHED_AT_OFFSET_MS).toISOString();
}

/** True when the stamp is the wire/studio hide marker, not a normal publish time. */
export function isFutureHoldStamp(publishedAt: string | null | undefined, now = Date.now()): boolean {
  if (!publishedAt) return false;
  const ms = Date.parse(publishedAt);
  return Number.isFinite(ms) && ms > now + 24 * 60 * 60 * 1000;
}

/**
 * Timestamp to write when Studio saves a story as published.
 * A draft (including a future hold stamp) becomes now. An already published
 * story keeps its original time.
 */
export function publishedAtForStudioPublish(input: {
  previousStatus: string;
  previousPublishedAt?: string | null;
  now?: number;
}): string | undefined {
  const now = input.now ?? Date.now();
  if (input.previousStatus !== "published" || isFutureHoldStamp(input.previousPublishedAt, now)) {
    return new Date(now).toISOString();
  }
  return undefined;
}

/** Pipeline failure text that must not ship as a public dek or excerpt. */
export function isHoldCopy(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return false;
  if (/^held\b/i.test(text)) return true;
  if (/house style:/i.test(text)) return true;
  return FAILURE_PREFIX.test(text);
}

export function stripHoldNote(html: string): string {
  return html.replace(HOLD_NOTE_RE, "").trim();
}

export function withHoldNote(html: string, reason: string): string {
  const safe = reason
    .replace(/-->/g, "")
    .replace(/\u2014/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (!safe) return stripHoldNote(html);
  return `<!-- tradeflock-hold: ${safe} -->\n${stripHoldNote(html)}`;
}

export function openingExcerpt(html: string, fallback: string): string {
  const text = stripHoldNote(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const base = text || fallback.trim() || "Draft";
  if (base.length <= 220) return base;
  return `${base.slice(0, 217).trim()}…`;
}

/** Public dek: the editor's excerpt, or the story opening. Never the hold reason. */
export function editorialDek(preferred: string, html: string, title: string): string {
  const clean = preferred.replace(/\s+/g, " ").trim();
  if (clean && !isHoldCopy(clean)) return clean.slice(0, 280);
  return openingExcerpt(html, title).slice(0, 280);
}
