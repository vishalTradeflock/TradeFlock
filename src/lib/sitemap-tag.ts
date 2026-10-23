/**
 * Tag for the sitemap. Publish paths expire it.
 * The `/sitemap.xml` response sends this as `Vercel-Cache-Tag`, and the
 * PostgREST read uses it as a Data Cache tag. One delete covers both.
 */
export const SITEMAP_CACHE_TAG = "sitemap";

/** Next.js drops cache tags longer than this, so revalidate would no-op. */
const CACHE_TAG_MAX = 256;

/**
 * Data Cache tag for one story's public reads (`article:<slug>`).
 * Edit, unpublish, and delete expire this tag only. Listing pages stay on
 * their own path revalidation, so the rest of the archive is left alone.
 */
export function articleCacheTag(slug: string | null | undefined): string | null {
  const clean = String(slug ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
  if (!clean || clean.includes("/") || clean.includes("?") || clean.includes("#")) return null;
  const tag = `article:${clean}`;
  return tag.length <= CACHE_TAG_MAX ? tag : null;
}
