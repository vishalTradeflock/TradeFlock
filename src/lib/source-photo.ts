/**
 * Source-article photos for the cover backfill. Pure helpers so `node --test`
 * can check URL extraction and rejection without fetching.
 *
 * Articles have no source_url column. An off-site canonical_url is used when
 * one is stored; otherwise the first external link in the body.
 */
import {
  coverPhotoKey,
  isCoverKeyTaken,
  isLegacyStockCover,
  isProfileCoverStory,
} from "./cover-dedupe.ts";
import { decodeCoverHtmlEntities, sanitizeCoverUrl } from "./images.ts";

export const SOURCE_FETCH_TIMEOUT_MS = 6_000;
export const SOURCE_BACKFILL_BUDGET_MS = 270_000;

/** A normal browser UA so publisher pages return the same HTML a reader gets. */
export const SOURCE_FETCH_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const SOCIAL_HOSTS = new Set([
  "facebook.com",
  "fb.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "t.co",
  "linkedin.com",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "pinterest.com",
  "reddit.com",
  "threads.net",
  "whatsapp.com",
  "wa.me",
  "t.me",
  "telegram.me",
]);

/** Site-wide defaults that must never become a story cover. */
const KNOWN_DEFAULT_IMAGE = /federalreserve\.gov\/images\/social-media\/social-default-image-opengraph\.jpg/i;

const GENERIC_IMAGE = /(logo|default|placeholder|favicon|sprite)/i;

export type SourcePageInput = {
  title: string;
  slug?: string | null;
  categorySlug?: string | null;
  /** Off-site canonical, when the row has one. There is no source_url column. */
  canonicalUrl?: string | null;
  body?: string | null;
};

export function isTradeflockHost(hostname: string) {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  return host.includes("tradeflock");
}

function hostIs(hostname: string, root: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === root || host.endsWith(`.${root}`);
}

function isSocialOrShareUrl(url: URL) {
  const host = url.hostname.toLowerCase();
  if (isTradeflockHost(host)) return true;
  if ([...SOCIAL_HOSTS].some((root) => hostIs(host, root))) return true;
  const path = `${url.pathname}${url.search}`.toLowerCase();
  return /sharer|sharearticle|\/share\b|intent\/tweet|sharing/.test(path);
}

/** Https article URL that is not this site, not a share button, and not an internal path. */
export function normalizeExternalArticleUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const decoded = decodeCoverHtmlEntities(value).trim();
  if (!decoded || decoded.startsWith("#") || decoded.startsWith("/") || /^mailto:|^tel:|^javascript:/i.test(decoded)) {
    return null;
  }
  try {
    const url = new URL(decoded);
    if (url.protocol !== "https:") return null;
    if (isSocialOrShareUrl(url)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function anchorHrefs(html: string): string[] {
  const hrefs: string[] = [];
  const pattern = /<a\b[^>]*\bhref\s*=\s*(["'])([\s\S]*?)\1/gi;
  for (const match of html.matchAll(pattern)) {
    const href = match[2]?.trim();
    if (href) hrefs.push(decodeCoverHtmlEntities(href));
  }
  return hrefs;
}

/**
 * Where to look for a source photo: an off-site canonical URL, otherwise the
 * first external `<a href>` in the body. Tradeflock, internal, and social/share
 * links are skipped.
 */
export function extractSourceArticleUrl(input: SourcePageInput): string | null {
  const fromCanonical = normalizeExternalArticleUrl(input.canonicalUrl);
  if (fromCanonical) return fromCanonical;
  const body = input.body ?? "";
  for (const href of anchorHrefs(body)) {
    const external = normalizeExternalArticleUrl(href);
    if (external) return external;
  }
  return null;
}

/** Success Insights / name-only profiles never take a photo from a source page. */
export function shouldTrySourcePhoto(input: SourcePageInput) {
  return !isProfileCoverStory(input.title, input.categorySlug, { slug: input.slug });
}

export type LogoImageHint = {
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  /** Class, asset label, or other markup that marks the file as a logo. */
  flaggedAsLogo?: boolean;
};

function hasLogoWord(value: string | null | undefined) {
  return Boolean(value && /\blogos?\b/i.test(value));
}

function parsePixel(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Very small icons, or square-ish brand marks that are not a large photograph.
 * Both sides are required so a lone `?w=1` cache-buster is not treated as a logo.
 */
export function isBrandMarkSize(width: number | null, height: number | null) {
  if (width == null || height == null || width <= 0 || height <= 0) return false;
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  if (long < 200) return true;
  return long <= 512 && long / short <= 1.25;
}

function dimensionsFromCoverUrl(url: string): { width: number | null; height: number | null } {
  try {
    const parsed = new URL(url);
    return {
      width: parsePixel(parsed.searchParams.get("w") ?? parsed.searchParams.get("width")),
      height: parsePixel(parsed.searchParams.get("h") ?? parsed.searchParams.get("height")),
    };
  } catch {
    return { width: null, height: null };
  }
}

/** PR Newswire / Cision logo files on the media CDN (mma and mmx). A photo on the same host is kept. */
export function isPrNewswireLogoAssetUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  const onPrNewswire = host === "prnewswire.com" || host.endsWith(".prnewswire.com");
  if (!onPrNewswire) return false;
  const path = decodeURIComponent(`${parsed.pathname} ${parsed.search}`).toLowerCase();
  return /\blogos?\b/.test(path) || /(?:^|[/_-])logos?(?:[./_-]|$)/.test(path);
}

/**
 * Logo-like source art: the word "logo" in the filename or alt text, a PR Newswire
 * logo asset, markup flagged as a logo, or a very small / square-ish brand mark.
 */
export function isLogoLikeSourceImage(url: string | null | undefined, hint?: LogoImageHint) {
  if (hint?.flaggedAsLogo || hasLogoWord(hint?.alt)) return true;
  if (isBrandMarkSize(hint?.width ?? null, hint?.height ?? null)) return true;
  if (typeof url !== "string" || !url.trim()) return false;
  const decoded = sanitizeCoverUrl(url) ?? decodeCoverHtmlEntities(url);
  if (GENERIC_IMAGE.test(decoded) || KNOWN_DEFAULT_IMAGE.test(decoded)) return true;
  if (isPrNewswireLogoAssetUrl(decoded)) return true;
  const sized = dimensionsFromCoverUrl(decoded);
  return isBrandMarkSize(sized.width, sized.height);
}

/** Logo, site-default, placeholder, favicon, sprite, brand mark, or a known default image. */
export function isUnusableSourceImageUrl(url: string | null | undefined) {
  if (typeof url !== "string" || !url.trim()) return true;
  if (isLogoLikeSourceImage(url)) return true;
  return isLegacyStockCover(url);
}

export type SourceImageDecision =
  | { ok: true; url: string; key: string }
  | { ok: false; reason: "invalid" | "logo" | "legacy" | "duplicate" };

/** Absolute https image that is not a default/logo, not legacy stock, and not already used. */
export function evaluateSourceImage(
  url: string | null | undefined,
  used: ReadonlySet<string>,
  hint?: LogoImageHint,
): SourceImageDecision {
  const absolute = typeof url === "string" ? sanitizeCoverUrl(url) : null;
  if (!absolute) return { ok: false, reason: "invalid" };
  if (isLogoLikeSourceImage(absolute, hint)) return { ok: false, reason: "logo" };
  if (isLegacyStockCover(absolute)) return { ok: false, reason: "legacy" };
  const key = coverPhotoKey(absolute);
  if (!key) return { ok: false, reason: "invalid" };
  if (isCoverKeyTaken(key, used)) return { ok: false, reason: "duplicate" };
  return { ok: true, url: absolute, key };
}

function resolveAgainst(pageUrl: string, raw: string | null | undefined): string | null {
  if (!raw) return null;
  const decoded = decodeCoverHtmlEntities(raw).trim();
  if (!decoded || decoded.startsWith("data:")) return null;
  try {
    return new URL(decoded, pageUrl).toString();
  } catch {
    return null;
  }
}

function metaContent(html: string, key: "og:image" | "twitter:image"): string | null {
  const property = key === "og:image" ? "property" : "name";
  const patterns = [
    new RegExp(`<meta[^>]+${property}=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${property}=["']${key}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const value = html.match(pattern)?.[1]?.trim();
    if (value) return value;
  }
  return null;
}

/** og:image, otherwise twitter:image, resolved against the page. Null when it is not a usable https image. */
export function ogImageFromHtml(html: string, pageUrl: string): string | null {
  const raw = metaContent(html, "og:image") ?? metaContent(html, "twitter:image");
  const absolute = resolveAgainst(pageUrl, raw);
  return absolute ? sanitizeCoverUrl(absolute) : null;
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"));
  return match?.[2]?.trim() ?? null;
}

function dimension(tag: string, name: string): number | null {
  const raw = attr(tag, name);
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
}

function isTinyImage(tag: string) {
  const width = dimension(tag, "width");
  const height = dimension(tag, "height");
  if (width !== null && height !== null) return Math.max(width, height) < 200;
  if (width !== null) return width < 200;
  if (height !== null) return height < 200;
  return false;
}

function metaByKey(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const value = html.match(pattern)?.[1]?.trim();
    if (value) return decodeCoverHtmlEntities(value);
  }
  return null;
}

/** Class, asset label, or alt text that marks a brand mark rather than a photograph. */
export function isFlaggedLogoTag(tag: string) {
  const className = attr(tag, "class") ?? "";
  if (/(?:^|\s)logos?(?:\s|$|[-_])/i.test(className)) return true;
  const label = attr(tag, "data-asset-label") ?? "";
  if (hasLogoWord(label)) return true;
  return hasLogoWord(attr(tag, "alt"));
}

function hintSkipsImage(hint: LogoImageHint) {
  return Boolean(
    hint.flaggedAsLogo || hasLogoWord(hint.alt) || isBrandMarkSize(hint.width ?? null, hint.height ?? null),
  );
}

/**
 * og:image, then twitter:image, then the first large `<img>`.
 * Relative URLs are resolved against the source page.
 */
export function sourceImageCandidatesFromHtml(html: string, pageUrl: string): string[] {
  const found: string[] = [];
  const push = (raw: string | null | undefined) => {
    const absolute = resolveAgainst(pageUrl, raw);
    if (!absolute) return;
    const key = absolute.split("#")[0];
    if (found.some((item) => item.split("#")[0] === key)) return;
    found.push(absolute);
  };
  const ogAlt = metaByKey(html, "og:image:alt");
  const ogWidth = parsePixel(metaByKey(html, "og:image:width"));
  const ogHeight = parsePixel(metaByKey(html, "og:image:height"));
  if (!hintSkipsImage({ alt: ogAlt, width: ogWidth, height: ogHeight })) {
    push(metaContent(html, "og:image"));
  }
  push(metaContent(html, "twitter:image"));
  for (const tag of html.matchAll(/<img\b[^>]*>/gi)) {
    const element = tag[0];
    if (isTinyImage(element) || isFlaggedLogoTag(element)) continue;
    if (isBrandMarkSize(dimension(element, "width"), dimension(element, "height"))) continue;
    const src = attr(element, "src");
    const lazy = attr(element, "data-src");
    const preferred = src && !src.startsWith("data:") ? src : lazy;
    push(preferred);
  }
  return found;
}

/** First candidate that passes the rejection rules. */
export function chooseSourceImage(candidates: readonly string[], used: ReadonlySet<string>): SourceImageDecision | null {
  let last: SourceImageDecision | null = null;
  for (const candidate of candidates) {
    const decision = evaluateSourceImage(candidate, used);
    if (decision.ok) return decision;
    last = decision;
  }
  return last;
}

/** Alt text from topic queries. Those queries already exclude personal names. */
export function sourceCoverAlt(queries: readonly string[]): string {
  const topic = queries.map((query) => query.trim()).find(Boolean);
  if (!topic) return "News photograph";
  return topic.charAt(0).toUpperCase() + topic.slice(1);
}

export async function fetchSourceImageCandidates(
  pageUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  const page = normalizeExternalArticleUrl(pageUrl);
  if (!page) return [];
  try {
    const response = await fetchImpl(page, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(SOURCE_FETCH_TIMEOUT_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": SOURCE_FETCH_USER_AGENT,
      },
    });
    if (!response.ok) return [];
    const type = response.headers.get("content-type") ?? "";
    if (type && !/text\/html|application\/xhtml\+xml/i.test(type)) return [];
    const html = await response.text();
    const base = response.url || page;
    return sourceImageCandidatesFromHtml(html, base);
  } catch {
    return [];
  }
}
