export const NEWSLETTER_SUBSCRIBED_KEY = "tf_newsletter_subscribed";
export const NEWSLETTER_DISMISSED_KEY = "tf_newsletter_dismissed";
export const NEWSLETTER_DELAY_MS = 5_000;
export const NEWSLETTER_DISMISS_DAYS = 7;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeNewsletterEmail(raw: unknown) {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return null;
  return email;
}

function parseDismissedBySlug(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [slug, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value) out[slug] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function dismissedAtForArticle(raw: string | null, slug: string) {
  if (!slug) return null;
  return parseDismissedBySlug(raw)[slug] ?? null;
}

export function rememberArticleDismiss(raw: string | null, slug: string, at: number) {
  const next = parseDismissedBySlug(raw);
  if (slug) next[slug] = String(at);
  return JSON.stringify(next);
}

export function shouldShowNewsletterPrompt({
  now,
  subscribed,
  dismissedAt,
}: {
  now: number;
  subscribed: string | null;
  dismissedAt: string | null;
}) {
  if (subscribed) return false;
  if (!dismissedAt) return true;
  const dismissedMs = Number(dismissedAt);
  if (!Number.isFinite(dismissedMs)) return true;
  const daysSinceDismissed = (now - dismissedMs) / (1000 * 60 * 60 * 24);
  return daysSinceDismissed >= NEWSLETTER_DISMISS_DAYS;
}
