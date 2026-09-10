export const FALLBACK_COVER_IMAGE =
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80";

const ALLOWED_HOSTS = new Set([
  "images.unsplash.com",
  "plus.unsplash.com",
]);

export function resolveCoverImage(url: string | null | undefined): string {
  if (!url) return FALLBACK_COVER_IMAGE;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return FALLBACK_COVER_IMAGE;
    if (parsed.hostname.endsWith("supabase.co")) return url;
    if (ALLOWED_HOSTS.has(parsed.hostname)) return url;
    return FALLBACK_COVER_IMAGE;
  } catch {
    return FALLBACK_COVER_IMAGE;
  }
}
