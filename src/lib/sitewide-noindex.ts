/**
 * Temporary TradeFlock.net indexing switch.
 * Flip to `false` (or delete this module and its call sites) after the SEO audit.
 */

// TEMPORARY SEO AUDIT: remove this flag after the audit is complete.
export const TEMPORARY_SITEWIDE_NOINDEX = true;

export const SITEWIDE_NOINDEX_META_CONTENT = "noindex,follow";
export const SITEWIDE_NOINDEX_HEADER_VALUE = "noindex, follow";

export function sitewideNoindexMetadata() {
  if (!TEMPORARY_SITEWIDE_NOINDEX) return {};
  return {
    robots: {
      index: false,
      follow: true,
    },
  };
}

export function sitewideNoindexHeaders() {
  if (!TEMPORARY_SITEWIDE_NOINDEX) return [];
  return [
    {
      source: "/",
      headers: [{ key: "X-Robots-Tag", value: SITEWIDE_NOINDEX_HEADER_VALUE }],
    },
    {
      source: "/:path*",
      headers: [{ key: "X-Robots-Tag", value: SITEWIDE_NOINDEX_HEADER_VALUE }],
    },
  ];
}
