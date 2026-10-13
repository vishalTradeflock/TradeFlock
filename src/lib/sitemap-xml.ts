import type { MetadataRoute } from "next";

/**
 * Same urlset document the App Router metadata renderer emits
 * (`resolveSitemap`): one urlset, no sitemap index.
 */
export function renderSitemapXml(entries: MetadataRoute.Sitemap) {
  let content = '<?xml version="1.0" encoding="UTF-8"?>\n';
  content += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const item of entries) {
    content += "<url>\n";
    content += `<loc>${item.url}</loc>\n`;
    if (item.lastModified) {
      const serialized =
        item.lastModified instanceof Date ? item.lastModified.toISOString() : item.lastModified;
      content += `<lastmod>${serialized}</lastmod>\n`;
    }
    if (item.changeFrequency) {
      content += `<changefreq>${item.changeFrequency}</changefreq>\n`;
    }
    if (typeof item.priority === "number") {
      content += `<priority>${item.priority}</priority>\n`;
    }
    content += "</url>\n";
  }
  content += "</urlset>\n";
  return content;
}
