/**
 * Tag for the sitemap. Publish paths expire it.
 * The `/sitemap.xml` response sends this as `Vercel-Cache-Tag`, and the
 * PostgREST read uses it as a Data Cache tag. One delete covers both.
 */
export const SITEMAP_CACHE_TAG = "sitemap";

/** Data Cache tag for public page reads. Publish paths expire it. */
export const PUBLISHED_PAGES_CACHE_TAG = "published-pages";
