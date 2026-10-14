import { PAGE_REVALIDATE_SECONDS } from "@/lib/cache";
import { SITEMAP_CACHE_TAG } from "@/lib/sitemap-tag";
import { loadSitemapEntries } from "@/lib/sitemap-source";
import { renderSitemapXml } from "@/lib/sitemap-xml";

/**
 * Dynamic route handler. Do not move this back to `app/sitemap.ts`, and do
 * not set `revalidate` or `force-static`.
 *
 * A prerendered metadata sitemap is a static file. The CDN keeps the build
 * snapshot, and neither a revalidate window nor `revalidatePath` runs the
 * route again.
 *
 * PR #43 cached this handler with `Cache-Control: s-maxage=86400` and
 * `export const revalidate = 86400`. Vercel then stored the XML as a CDN
 * entry for that TTL. `revalidatePath("/sitemap.xml")` only expires Next's
 * path tag. `revalidateTag("sitemap")` only expired the tagged PostgREST
 * read. Neither tag was on the HTTP response, so the edge kept serving the
 * HIT until `s-maxage` elapsed. ISR also drops raw response headers, so a
 * `Vercel-Cache-Tag` set on a revalidated handler would not stick.
 *
 * This handler stays dynamic so the headers reach the CDN. The CDN caches
 * the body for a day. Browsers get `max-age=0`. The response carries the
 * `sitemap` tag that `revalidatePublishedSitemap()` already deletes with
 * `revalidateTag(..., { expire: 0 })`. On Next.js 16 that delete purges the
 * CDN entry, so the next request regenerates. The one-day TTL is the backstop.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SITEMAP_CDN_CACHE_CONTROL = `public, s-maxage=${PAGE_REVALIDATE_SECONDS}, stale-while-revalidate=${PAGE_REVALIDATE_SECONDS}`;

export async function GET() {
  const xml = renderSitemapXml(await loadSitemapEntries());
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=0",
      "Vercel-CDN-Cache-Control": SITEMAP_CDN_CACHE_CONTROL,
      "Vercel-Cache-Tag": SITEMAP_CACHE_TAG,
    },
  });
}
