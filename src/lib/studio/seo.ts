import { getBaseUrl } from "@/lib/site-url";
import { articlePath } from "@/lib/types";

export const SEO_TITLE_LIMIT = 60;
export const SEO_DESCRIPTION_LIMIT = 160;

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
  return articlePath(slug);
}

export function publicStoryUrl(slug: string) {
  return `${getBaseUrl()}${publicStoryPath(slug)}`;
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
