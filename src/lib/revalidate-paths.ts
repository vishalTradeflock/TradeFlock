import {
  EDITORIAL_LISTINGS_TAG,
  SITEMAP_CACHE_TAG,
  SUCCESS_INSIGHTS_CACHE_TAG,
  articleCacheTag,
  authorArticlesTag,
  deskCacheTag,
  slugRedirectTag,
} from "./cache.ts";
import { sectionPath } from "./types.ts";

/** Desk URL for a category slug. Unknown slugs do not fall back to the homepage. */
export function listingPathForCategory(slug: string | null | undefined): string | null {
  const clean = slug?.trim().toLowerCase() ?? "";
  if (!clean) return null;
  if (clean === "technology") return "/tech";
  const path = sectionPath(clean);
  return path === "/" ? null : path;
}

export function embeddedSlug(value: unknown): string | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object" || !("slug" in row)) return null;
  const slug = (row as { slug?: unknown }).slug;
  return typeof slug === "string" && slug.trim() ? slug.trim() : null;
}

export type PublishedArticleInvalidation = {
  slug: string;
  previousSlug?: string | null;
  categorySlug?: string | null;
  previousCategorySlug?: string | null;
  authorSlug?: string | null;
  previousAuthorSlug?: string | null;
  authorId?: string | null;
  previousAuthorId?: string | null;
};

function cleanPathSlug(slug: string | null | undefined) {
  return slug?.trim().replace(/^\/+|\/+$/g, "") ?? "";
}

/** Pages whose HTML actually depends on this story. Never the root layout. */
export function pathsForPublishedArticle(input: PublishedArticleInvalidation): string[] {
  const paths = new Set<string>(["/", "/sitemap.xml"]);
  const slug = cleanPathSlug(input.slug);
  if (slug) paths.add(`/${slug}`);
  const previous = cleanPathSlug(input.previousSlug);
  if (previous && previous !== slug) paths.add(`/${previous}`);
  for (const category of [input.categorySlug, input.previousCategorySlug]) {
    const path = listingPathForCategory(category);
    if (path) paths.add(path);
  }
  for (const author of [input.authorSlug, input.previousAuthorSlug]) {
    const clean = cleanPathSlug(author);
    if (clean) paths.add(`/author/${clean}`);
  }
  return [...paths];
}

/** Tags for the fetches those pages use. Not a tag shared by every story page. */
export function tagsForPublishedArticle(input: PublishedArticleInvalidation): string[] {
  const tags = new Set<string>([EDITORIAL_LISTINGS_TAG, SITEMAP_CACHE_TAG]);
  const slug = cleanPathSlug(input.slug);
  if (slug) tags.add(articleCacheTag(slug));
  const previous = cleanPathSlug(input.previousSlug);
  if (previous && previous !== slug) {
    tags.add(articleCacheTag(previous));
    tags.add(slugRedirectTag(previous));
  }
  for (const category of [input.categorySlug, input.previousCategorySlug]) {
    const path = listingPathForCategory(category);
    if (!path) continue;
    tags.add(deskCacheTag(path.slice(1)));
    if (path === "/success-insights") tags.add(SUCCESS_INSIGHTS_CACHE_TAG);
  }
  if (input.authorId?.trim()) tags.add(authorArticlesTag(input.authorId));
  if (input.previousAuthorId?.trim() && input.previousAuthorId !== input.authorId) {
    tags.add(authorArticlesTag(input.previousAuthorId));
  }
  return [...tags];
}

export function pathsForPublishedArticles(
  articles: PublishedArticleInvalidation[],
  extraPaths: string[] = [],
): string[] {
  const paths = new Set<string>();
  for (const article of articles) {
    for (const path of pathsForPublishedArticle(article)) paths.add(path);
  }
  for (const path of extraPaths) {
    if (path.startsWith("/")) paths.add(path);
  }
  return [...paths];
}

export function tagsForPublishedArticles(
  articles: PublishedArticleInvalidation[],
  extraTags: string[] = [],
): string[] {
  const tags = new Set<string>();
  for (const article of articles) {
    for (const tag of tagsForPublishedArticle(article)) tags.add(tag);
  }
  for (const tag of extraTags) {
    if (tag.trim()) tags.add(tag.trim());
  }
  return [...tags];
}
