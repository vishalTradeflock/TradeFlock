export const SEO_TITLE_LIMIT = 60;
export const SEO_DESCRIPTION_LIMIT = 160;
export const PUBLIC_SITE_HOST = "www.tradeflockusa.com";

export function resolveSeoTitle(metaTitle: string | null | undefined, title: string) {
  const custom = metaTitle?.trim();
  return custom || title.trim() || "TradeFlock USA";
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
  const clean = slug.trim().replace(/^\/+|\/+$/g, "");
  return clean ? `/news/${clean}` : "/news/";
}

export function publicStoryUrl(slug: string) {
  return `https://${PUBLIC_SITE_HOST}${publicStoryPath(slug)}`;
}

export function previewSlug(slug: string, title: string) {
  const saved = slug.trim();
  if (saved) return saved;
  const fromTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return fromTitle || "story";
}
