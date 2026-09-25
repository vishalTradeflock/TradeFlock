import {
  blankRepeatedCovers,
  coverPhotoKey,
  isLegacyStockCover,
  LEGACY_STOCK_COVER_KEYS,
} from "./cover-dedupe.ts";

/**
 * Legacy global fallback (glass skyscrapers). Never write it to a story and
 * never render it as a stand-in: it ended up on 220 stories. Kept only so old
 * rows can be recognised. Missing covers now render the neutral branded card.
 */
export const FALLBACK_COVER_IMAGE =
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80";

export const PLACEHOLDER_COVER = "/placeholder.jpg";

/** Hosts listed in next.config.ts `images.remotePatterns` (exact match). */
const OPTIMIZED_COVER_HOSTS = new Set([
  "images.unsplash.com",
  "plus.unsplash.com",
  "www.tradeflock.net",
  "tradeflock.net",
  "www.tradeflockusa.com",
  "tradeflockusa.com",
  "tradeflock.com",
  "www.tradeflock.com",
  "www.tradeflock.us",
  "tradeflock.us",
  "image.cnbcfm.com",
  "techcrunch.com",
  "www.techcrunch.com",
  "mmx.prnewswire.com",
  "www.prnewswire.com",
  "prnewswire.com",
]);

/** Single-segment wildcards from remotePatterns (`*.supabase.co`, `*.techcrunch.com`). */
const OPTIMIZED_COVER_HOST_SUFFIXES = [".supabase.co", ".techcrunch.com"] as const;

type CoverSource = {
  id: string;
  title: string;
  cover_image_url?: string | null;
};

export type CoverArticleRef = {
  id: string;
  title: string;
  slug?: string;
  category?: { slug?: string | null };
};

/** Same Unsplash photo with different query strings still counts as one image. */
export function coverIdentity(url: string) {
  return coverPhotoKey(url) ?? url.split("?")[0];
}

/** Stable hotlink for the Studio editor (TipTap <img src>, not next/image). */
export function unsplashEditorSrc(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "images.unsplash.com" && parsed.hostname !== "plus.unsplash.com") {
      return url;
    }
    return `https://${parsed.hostname}${parsed.pathname}?auto=format&fit=crop&w=1600&q=80`;
  } catch {
    return url;
  }
}

/** Decode `&amp;` / `&amp;amp;` (and numeric entities) so query strings stay valid. */
export function decodeCoverHtmlEntities(value: string): string {
  let decoded = value.trim();
  for (let i = 0; i < 5; i += 1) {
    const next = decoded
      .replace(/&#(\d+);/g, (_, code: string) => {
        const point = Number(code);
        return Number.isFinite(point) && point > 0 ? String.fromCodePoint(point) : "";
      })
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => {
        const point = Number.parseInt(hex, 16);
        return Number.isFinite(point) && point > 0 ? String.fromCodePoint(point) : "";
      })
      .replace(/&nbsp;/gi, " ")
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&amp;/gi, "&");
    if (next === decoded) break;
    decoded = next;
  }
  return decoded.trim();
}

/**
 * Trim, decode HTML entities, and reject empty / non-https / document URLs.
 * Never invents a host; returns null so callers render the neutral card.
 */
export function sanitizeCoverUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const decoded = decodeCoverHtmlEntities(url);
  if (!decoded) return null;
  if (/[<>\s]/.test(decoded)) return null;
  if (/&(?:amp|lt|gt|quot|apos|nbsp);/i.test(decoded)) return null;
  try {
    const parsed = new URL(decoded);
    if (parsed.protocol !== "https:") return null;
    if (!parsed.hostname.includes(".")) return null;
    if (parsed.username || parsed.password) return null;
    if (/\.(pdf|html?|xml|json|mp4|webm|mov)(\?|$)/i.test(parsed.pathname)) return null;
    const href = parsed.toString();
    if (!href || href === PLACEHOLDER_COVER) return null;
    return href;
  } catch {
    return null;
  }
}

/** True for a real https cover URL (feed enclosure / og:image). Never invents a URL. */
export function isHttpsCoverUrl(url: string | null | undefined): url is string {
  return sanitizeCoverUrl(url) !== null;
}

/**
 * A renderable cover URL, or null. Legacy shared stock photos count as "no
 * cover" so they are never shown as a stand-in on another story.
 */
export function resolveCoverImage(url: string | null | undefined): string | null {
  const sanitized = sanitizeCoverUrl(url);
  if (!sanitized || isLegacyStockCover(sanitized)) return null;
  return sanitized;
}

/**
 * Source-provided cover candidates in priority order: RSS/enclosure, lead
 * notes, og:image. No invented stock fallback — uniqueness is enforced by
 * `pickUniqueCover` (src/lib/cover-picker.ts).
 */
export function publishCoverCandidates(input: {
  rssImageUrl?: string | null;
  notesCoverUrl?: string | null;
  ogImageUrl?: string | null;
}): string[] {
  return [input.rssImageUrl, input.notesCoverUrl, input.ogImageUrl]
    .map((url) => resolveCoverImage(url))
    .filter((url): url is string => Boolean(url));
}

/** First usable source cover (RSS → notes → og:image), or null. */
export function selectPublishCover(input: {
  rssImageUrl?: string | null;
  notesCoverUrl?: string | null;
  ogImageUrl?: string | null;
  article?: CoverArticleRef;
}): string | null {
  return publishCoverCandidates(input)[0] ?? null;
}

/** True when next/image can optimize this host (matches next.config remotePatterns). */
export function isOptimizedCoverHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!host) return false;
  if (OPTIMIZED_COVER_HOSTS.has(host)) return true;
  return OPTIMIZED_COVER_HOST_SUFFIXES.some(
    (suffix) => host.endsWith(suffix) && host.length > suffix.length,
  );
}

/** Native <img> for exotic feed hosts; next/image for allowlisted remotePatterns. */
export function shouldBypassImageOptimizer(url: string): boolean {
  if (url.startsWith("/")) return false;
  try {
    return !isOptimizedCoverHost(new URL(url).hostname);
  } catch {
    return true;
  }
}

/**
 * Cover to render for a story: its own sanitized URL, or "" (neutral branded
 * card). Never substitutes a shared stock photo.
 */
export function articleCoverSrc(article: CoverArticleRef & { cover_image_url?: string | null }): string {
  return resolveCoverImage(article.cover_image_url) ?? "";
}

export function isStockCoverUrl(url: string | null | undefined) {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  if (
    /building|skyscraper|placeholder|unsplash\.com|plus\.unsplash/.test(lower)
  ) {
    return true;
  }
  if (trimmed === FALLBACK_COVER_IMAGE || trimmed === PLACEHOLDER_COVER) return true;
  const identity = coverPhotoKey(trimmed);
  return identity !== null && LEGACY_STOCK_COVER_KEYS.has(identity);
}

export function portraitImageUrl(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || isStockCoverUrl(trimmed)) continue;
    if (trimmed.startsWith("/")) return trimmed;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "https:") return trimmed;
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * List-level guard: each story renders its own cover, and a cover identity
 * already shown earlier in the list renders as the neutral card instead.
 */
export function assignDistinctCovers<T extends CoverSource>(articles: T[]): T[] {
  return blankRepeatedCovers(
    articles.map((article) => ({
      ...article,
      cover_image_url: resolveCoverImage(article.cover_image_url) ?? "",
    })),
  );
}
