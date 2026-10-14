import { revalidatePath, revalidateTag } from "next/cache";
import { publishedRefreshPaths, type PublishedRefreshTarget } from "@/lib/published-refresh";
import { PUBLISHED_PAGES_CACHE_TAG, SITEMAP_CACHE_TAG } from "@/lib/sitemap-tag";

export { SITEMAP_CACHE_TAG };
export type { PublishedRefreshTarget };

/**
 * Drop cached public pages and the sitemap after published content changes.
 * Callers pass the slugs they already have. This does not query Supabase.
 *
 * `revalidateTag("sitemap", { expire: 0 })` is what refreshes `/sitemap.xml`
 * on Vercel. The route sends `Vercel-Cache-Tag: sitemap`, and on Next.js 16
 * an expire-0 tag delete purges that CDN entry. `revalidatePath` only
 * expires Next's path tag; it does not purge a route-handler response the
 * CDN stored from `s-maxage`.
 */
export function revalidatePublishedSitemap(target?: PublishedRefreshTarget) {
  revalidateTag(SITEMAP_CACHE_TAG, { expire: 0 });
  revalidateTag(PUBLISHED_PAGES_CACHE_TAG, { expire: 0 });
  revalidatePath("/sitemap.xml");
  if (!target) return;
  for (const path of publishedRefreshPaths(target)) {
    revalidatePath(path);
  }
}
