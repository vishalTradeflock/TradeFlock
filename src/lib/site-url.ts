function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function withHttps(hostOrUrl: string) {
  const trimmed = hostOrUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) return stripTrailingSlash(trimmed);
  return stripTrailingSlash(`https://${trimmed.replace(/^\/+/, "")}`);
}

/** Canonical site origin for sitemap, metadata, and JSON-LD. */
export function getBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return withHttps(configured);

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return withHttps(vercel);

  return "http://localhost:3000";
}

export function getSiteHost() {
  try {
    return new URL(getBaseUrl()).host;
  } catch {
    return "localhost:3000";
  }
}
