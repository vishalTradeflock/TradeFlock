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

export const EDITORIAL_COVERS = [
  // Tech / AI
  "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1518773553398-650c184e0bb3?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=1200&q=80",
  // Markets / Trading
  "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1200&q=80",
  // Finance / Banking
  "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1565514020176-b31d2542ed3e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1526304640173-94cb2232017e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
  // Leadership
  "https://images.unsplash.com/photo-1521737711867-e3b973223fbd?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=1200&q=80",
] as const;

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

function hashKey(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Same Unsplash photo with different query strings still counts as one image. */
export function coverIdentity(url: string) {
  const photo = url.match(/photo-[a-zA-Z0-9_-]+/);
  if (photo) return photo[0];
  return url.split("?")[0];
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
 * Never invents a host; returns null so callers can fall back to a desk Unsplash URL.
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

export function resolveCoverImage(url: string | null | undefined): string {
  return sanitizeCoverUrl(url) ?? FALLBACK_COVER_IMAGE;
}

/** RSS/enclosure first, then og:image, then a deterministic desk Unsplash hotlink. */
export function selectPublishCover(input: {
  rssImageUrl?: string | null;
  notesCoverUrl?: string | null;
  ogImageUrl?: string | null;
  article: CoverArticleRef;
}): string {
  const fromFeed =
    sanitizeCoverUrl(input.rssImageUrl) ?? sanitizeCoverUrl(input.notesCoverUrl);
  if (fromFeed) return fromFeed;
  const fromOg = sanitizeCoverUrl(input.ogImageUrl);
  if (fromOg) return fromOg;
  return deskCoverFallback(input.article);
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

export function pickEditorialCover(article: CoverSource, offset = 0) {
  const index =
    (article.title.length + hashKey(article.id) + offset) % EDITORIAL_COVERS.length;
  return EDITORIAL_COVERS[index];
}

const DESK_COVER_POOLS: Record<string, readonly string[]> = {
  tech: EDITORIAL_COVERS.slice(0, 7),
  technology: EDITORIAL_COVERS.slice(0, 7),
  markets: EDITORIAL_COVERS.slice(7, 14),
  finance: EDITORIAL_COVERS.slice(14, 20),
  leadership: EDITORIAL_COVERS.slice(20, 26),
};

/** Deterministic stand-in when a story has no usable cover — keyed by id/slug, not row index. */
export function deskCoverFallback(article: {
  id: string;
  title: string;
  slug?: string;
  category?: { slug?: string | null };
}) {
  const desk = article.category?.slug?.trim().toLowerCase() ?? "";
  const pool = DESK_COVER_POOLS[desk] ?? EDITORIAL_COVERS;
  const index = hashKey(`${article.id}:${article.slug ?? article.title}:${desk}`) % pool.length;
  return pool[index];
}

export function articleCoverSrc(article: CoverArticleRef & { cover_image_url?: string | null }) {
  const sanitized = sanitizeCoverUrl(article.cover_image_url);
  if (!sanitized || sanitized === FALLBACK_COVER_IMAGE) {
    return deskCoverFallback(article);
  }
  return sanitized;
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
  const identity = coverIdentity(trimmed);
  if (identity === coverIdentity(FALLBACK_COVER_IMAGE)) return true;
  return EDITORIAL_COVERS.some((cover) => coverIdentity(cover) === identity);
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

export function assignDistinctCovers<T extends CoverSource>(articles: T[]): T[] {
  const used = new Set<string>();
  let previous = "";

  return articles.map((article, index) => {
    const sanitized = sanitizeCoverUrl(article.cover_image_url);
    let url =
      !sanitized || sanitized === FALLBACK_COVER_IMAGE
        ? pickEditorialCover(article, index)
        : sanitized;
    let identity = coverIdentity(url);

    if (used.has(identity) || identity === previous) {
      for (let step = 1; step <= EDITORIAL_COVERS.length; step += 1) {
        const candidate = pickEditorialCover(article, index + step);
        const candidateId = coverIdentity(candidate);
        if (!used.has(candidateId) && candidateId !== previous) {
          url = candidate;
          identity = candidateId;
          break;
        }
      }
    }

    used.add(identity);
    previous = identity;
    return { ...article, cover_image_url: url };
  });
}
