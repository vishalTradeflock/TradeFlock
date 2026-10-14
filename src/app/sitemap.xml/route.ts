import { PAGE_REVALIDATE_SECONDS } from "@/lib/cache";
import { loadSitemapEntries } from "@/lib/sitemap-source";
import { renderSitemapXml } from "@/lib/sitemap-xml";

/**
 * ISR route handler. Do not move this back to `app/sitemap.ts`.
 *
 * A prerendered metadata sitemap is emitted as a static file. The CDN then
 * keeps the build snapshot, and neither the revalidate window nor
 * `revalidatePath` runs the route again. This file stays a route handler so
 * the response lives in the Full Route Cache with a one-day revalidate.
 *
 * Publish reaches the CDN copy through `revalidatePublishedSitemap()`:
 * `revalidateTag(sitemap, { expire: 0 })` drops the tagged PostgREST reads,
 * and `revalidatePath("/sitemap.xml")` deletes the cached response. On Vercel
 * that path delete purges the CDN entry, so the next crawler regenerates
 * instead of sitting out `s-maxage`. The cache header is only the backstop.
 *
 * `revalidate` must be a numeric literal. Next does not evaluate expressions
 * when it records the prerender window. Keep it equal to
 * `PAGE_REVALIDATE_SECONDS`.
 */
export const revalidate = 86400;
export const maxDuration = 60;

const SITEMAP_CACHE_CONTROL = `public, max-age=0, s-maxage=${PAGE_REVALIDATE_SECONDS}, stale-while-revalidate=${PAGE_REVALIDATE_SECONDS}`;

export async function GET() {
  const xml = renderSitemapXml(await loadSitemapEntries());
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": SITEMAP_CACHE_CONTROL,
    },
  });
}
