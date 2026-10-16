import { getBaseUrl } from "../site-url.ts";
import { articlePath } from "../types.ts";
import { slugFromTitle } from "./slug.ts";

export const SEO_TITLE_LIMIT = 60;
export const SEO_DESCRIPTION_LIMIT = 160;
/** " | TradeFlock USA" is appended only when the keyword title is this short. */
export const TITLE_BRAND_SUFFIX_MAX = 50;
export const TITLE_BRAND_SUFFIX = " | TradeFlock USA";

export function resolveSeoTitle(metaTitle: string | null | undefined, title: string) {
  const custom = metaTitle?.trim();
  return custom || title.trim() || "TradeFlock USA";
}

/** Hard display cap for a custom SEO title. No ellipsis. */
export function capDisplayTitle(value: string, limit = SEO_TITLE_LIMIT) {
  const trimmed = value.trim();
  if (trimmed.length <= limit) return trimmed;
  return trimmed.slice(0, limit).trimEnd();
}

/**
 * Title for the document, Open Graph, and Twitter cards.
 * Uses articles.meta_title when set (capped at 60 characters), otherwise the headline.
 * The brand suffix is added only when that string is 50 characters or fewer,
 * so the root "%s | TradeFlock USA" template must not be applied again.
 */
export function articleDocumentTitle(metaTitle: string | null | undefined, headline: string) {
  const custom = metaTitle?.trim();
  const base = custom ? capDisplayTitle(custom) : resolveSeoTitle(null, headline);
  if (base.length <= TITLE_BRAND_SUFFIX_MAX) return `${base}${TITLE_BRAND_SUFFIX}`;
  return base;
}

export function resolveSeoDescription(
  metaDescription: string | null | undefined,
  excerpt: string,
) {
  const custom = metaDescription?.trim();
  return custom || excerpt.trim() || "U.S. business news from TradeFlock USA.";
}

export function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

export function publicStoryPath(slug: string) {
  return articlePath(slug);
}

export function publicStoryUrl(slug: string) {
  return `${getBaseUrl()}${publicStoryPath(slug)}`;
}

export function previewSlug(slug: string, title: string) {
  const saved = slug.trim();
  if (saved) return saved;
  return slugFromTitle(title);
}
