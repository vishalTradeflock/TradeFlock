/** ISR window for public pages and the cookie-free Supabase fetch cache. */
export const PAGE_REVALIDATE_SECONDS = 120;

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
