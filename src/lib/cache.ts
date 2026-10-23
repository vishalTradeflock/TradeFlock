/**
 * Once-a-day backstop for public pages and the cookie-free Supabase fetch cache.
 * Publish paths revalidate the specific page immediately; this is only the fallback.
 */
export const PAGE_REVALIDATE_SECONDS = 86400;

/**
 * Cache-key bucket for `published_at=lte`. Rounded up so a story published
 * during the bucket is included on the on-demand re-render. A millisecond
 * timestamp would make every PostgREST URL unique.
 */
export const PUBLISHED_AT_BUCKET_SECONDS = 60;

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
 * Upper bound for `published_at=lte`, rounded up to the cache-key bucket.
 * A millisecond timestamp makes every PostgREST URL unique, so Next's
 * fetch cache misses on every render.
 */
export function publishedAtCutoff(now = Date.now()) {
  const windowMs = PUBLISHED_AT_BUCKET_SECONDS * 1000;
  return new Date(Math.ceil(now / windowMs) * windowMs).toISOString();
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
