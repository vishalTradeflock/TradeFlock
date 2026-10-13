import { loadSitemapEntries } from "@/lib/sitemap-source";
import { renderSitemapXml } from "@/lib/sitemap-xml";

/**
 * Must stay dynamic. A prerendered `/sitemap.xml` (including `revalidate = 900`
 * on `sitemap.ts`) is emitted as a static file, so the CDN keeps the build
 * snapshot and neither the revalidate window nor `revalidatePath` runs the
 * route again. This handler runs on request. Its Supabase reads are
 * force-cached under the `sitemap` tag and are not on a timer; publish paths
 * expire that tag.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export async function GET() {
  const xml = renderSitemapXml(await loadSitemapEntries());
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
