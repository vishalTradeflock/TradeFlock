/**
 * Safety-net ISR for homepage, desks, authors, and magazine indexes.
 * Publishing revalidates those paths on demand; this only covers a missed event.
 * Page files must use the literal `3600` — Next does not accept an imported value.
 */
export const LISTING_REVALIDATE_SECONDS = 3600;

/**
 * Safety-net ISR for a published story. The story, its desk, and the homepage
 * are revalidated on demand when that story changes.
 * Page files must use the literal `86400`.
 */
export const ARTICLE_REVALIDATE_SECONDS = 86400;

/**
 * Bucket for `published_at=lte` and the default public fetch window.
 * Kept equal to the listing interval so list URLs stay stable for that long.
 */
export const PAGE_REVALIDATE_SECONDS = LISTING_REVALIDATE_SECONDS;

export const EDITORIAL_LISTINGS_TAG = "editorial-listings";
export const SUCCESS_INSIGHTS_CACHE_TAG = "success-insights";
export const SITEMAP_CACHE_TAG = "sitemap";
export const MAGAZINES_CACHE_TAG = "magazines";

export function articleCacheTag(slug: string) {
  return `article:${slug.trim()}`;
}

export function authorProfileTag(slug: string) {
  return `author:${slug.trim()}`;
}

export function authorArticlesTag(authorId: string) {
  return `author-articles:${authorId.trim()}`;
}

export function slugRedirectTag(slug: string) {
  return `slug-redirect:${slug.trim()}`;
}

export type PublicReadScope = "listing" | "embedded" | "author";

export function deskCacheTag(slug: string) {
  const clean = slug.trim().toLowerCase();
  if (clean === "technology") return "desk:tech";
  return `desk:${clean}`;
}

/** Fetch-cache policy. Embedded reads stay off the shared listing tag. */
export function publicReadCache(
  scope: PublicReadScope = "listing",
  authorId?: string,
  categorySlug?: string,
) {
  if (scope === "embedded") {
    return { revalidate: ARTICLE_REVALIDATE_SECONDS };
  }
  if (scope === "author") {
    const id = authorId?.trim();
    return id
      ? { revalidate: LISTING_REVALIDATE_SECONDS, tags: [authorArticlesTag(id)] }
      : { revalidate: LISTING_REVALIDATE_SECONDS, tags: [EDITORIAL_LISTINGS_TAG] };
  }
  const desk = categorySlug?.trim();
  if (desk) {
    return { revalidate: LISTING_REVALIDATE_SECONDS, tags: [deskCacheTag(desk)] };
  }
  return { revalidate: LISTING_REVALIDATE_SECONDS, tags: [EDITORIAL_LISTINGS_TAG] };
}

export function articleReadCache(slug: string) {
  return { revalidate: ARTICLE_REVALIDATE_SECONDS, tags: [articleCacheTag(slug)] };
}

export function slugRedirectReadCache(slug: string) {
  return { revalidate: ARTICLE_REVALIDATE_SECONDS, tags: [slugRedirectTag(slug)] };
}

export function magazineReadCache() {
  return { revalidate: LISTING_REVALIDATE_SECONDS, tags: [MAGAZINES_CACHE_TAG] };
}

export function sitemapReadCache() {
  return { revalidate: ARTICLE_REVALIDATE_SECONDS, tags: [SITEMAP_CACHE_TAG] };
}

export function successInsightsReadCache() {
  return { revalidate: LISTING_REVALIDATE_SECONDS, tags: [SUCCESS_INSIGHTS_CACHE_TAG] };
}

export function authorProfileReadCache(slug: string) {
  return { revalidate: LISTING_REVALIDATE_SECONDS, tags: [authorProfileTag(slug)] };
}

/**
 * Rows kept past the page's own limit. The SQL filters already drop Success
 * Insights; this only covers list rows that cannot be mapped (missing author).
 */
export const EDITORIAL_LIST_PAD = 8;

export function editorialQueryLimit(limit: number) {
  const safe = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  return Math.min(safe + EDITORIAL_LIST_PAD, 400);
}

/**
 * Upper bound for `published_at=lte`, rounded up to the end of the ISR window.
 * A millisecond timestamp makes every PostgREST URL unique, so Next's fetch
 * cache misses on every render. Ceiling (not floor) keeps that URL stable
 * while still including stories published during the current window.
 * Hold drafts are stamped a year ahead, so they stay hidden.
 */
export function publishedAtCutoff(now = Date.now()) {
  const windowMs = PAGE_REVALIDATE_SECONDS * 1000;
  const end = Math.floor(now / windowMs) * windowMs + windowMs;
  return new Date(end).toISOString();
}

/** One homepage list query. Rails are derived in memory from this set. */
export const HOME_ARTICLE_LIMIT = 60;

/** Latest section: remaining editorial stories, three per page. */
export const LATEST_SCROLLER_LIMIT = 30;

/** Numbered Big Take rail on the homepage. */
export const BIG_TAKE_LIMIT = 20;

/** Success Insights archive page (list fields only — never `body`). */
export const SUCCESS_INSIGHTS_ARCHIVE_LIMIT = 1000;

/** Leadership spotlights shown in the original 3-up grid (paged). */
export const SUCCESS_INSIGHTS_SPOTLIGHT_COUNT = 12;
