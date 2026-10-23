import { revalidatePath, revalidateTag } from "next/cache";
import { publishedRefreshPaths, type PublishedRefreshTarget } from "@/lib/published-refresh";
import { articleCacheTag, SITEMAP_CACHE_TAG } from "@/lib/sitemap-tag";

export { SITEMAP_CACHE_TAG };
export type { PublishedRefreshTarget };

/**
 * Refresh the sitemap and the paths a content change actually renders.
 * Callers pass the slugs they already have. This does not query Supabase.
 *
 * `revalidateTag("sitemap", { expire: 0 })` is what refreshes `/sitemap.xml`
 * on Vercel. The route sends `Vercel-Cache-Tag: sitemap`, and on Next.js 16
 * an expire-0 tag delete purges that CDN entry. `revalidatePath` only
 * expires Next's path tag; it does not purge a route-handler response the
 * CDN stored from `s-maxage`.
 *
 * Story reads are tagged `article:<slug>`. Expiring that tag refreshes the
 * edited, unpublished, or deleted story without expiring every other page.
 * Home, section, author, and listing URLs are refreshed with `revalidatePath`.
 * There is no shared tag across public fetches: that purge rewrote the archive.
 */
export function revalidatePublishedSitemap(target?: PublishedRefreshTarget) {
  revalidateTag(SITEMAP_CACHE_TAG, { expire: 0 });
  revalidatePath("/sitemap.xml");
  if (!target) return;

  const seen = new Set<string>();
  for (const slug of target.articleSlugs ?? []) {
    const tag = articleCacheTag(slug);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    revalidateTag(tag, { expire: 0 });
  }

  for (const path of publishedRefreshPaths(target)) {
    revalidatePath(path);
  }
}
