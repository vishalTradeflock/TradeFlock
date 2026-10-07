/** ISR window for public pages and the cookie-free Supabase fetch cache. */
export const PAGE_REVALIDATE_SECONDS = 120;

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
 * Upper bound for `published_at=lte`, floored to the ISR window.
 * A millisecond timestamp makes every PostgREST URL unique, so Next's
 * fetch cache misses on every render.
 */
export function publishedAtCutoff(now = Date.now()) {
  const windowMs = PAGE_REVALIDATE_SECONDS * 1000;
  return new Date(Math.floor(now / windowMs) * windowMs).toISOString();
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
