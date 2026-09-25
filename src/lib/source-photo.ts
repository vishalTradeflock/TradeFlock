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

/** Logo, site-default, placeholder, favicon, sprite, or a known default image. */
export function isUnusableSourceImageUrl(url: string | null | undefined) {
  if (typeof url !== "string" || !url.trim()) return true;
  const lower = url.toLowerCase();
  if (KNOWN_DEFAULT_IMAGE.test(lower) || GENERIC_IMAGE.test(lower)) return true;
  return isLegacyStockCover(url);
}

export type SourceImageDecision =
  | { ok: true; url: string; key: string }
  | { ok: false; reason: "invalid" | "logo" | "legacy" | "duplicate" };

/** Absolute https image that is not a default/logo, not legacy stock, and not already used. */
export function evaluateSourceImage(url: string | null | undefined, used: ReadonlySet<string>): SourceImageDecision {
  const absolute = typeof url === "string" ? sanitizeCoverUrl(url) : null;
  if (!absolute) return { ok: false, reason: "invalid" };
  if (GENERIC_IMAGE.test(absolute) || KNOWN_DEFAULT_IMAGE.test(absolute)) return { ok: false, reason: "logo" };
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
  push(metaContent(html, "og:image"));
  push(metaContent(html, "twitter:image"));
  for (const tag of html.matchAll(/<img\b[^>]*>/gi)) {
    const element = tag[0];
    if (isTinyImage(element)) continue;
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
