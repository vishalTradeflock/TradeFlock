function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function withHttps(hostOrUrl: string) {
  const trimmed = hostOrUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) return stripTrailingSlash(trimmed);
  return stripTrailingSlash(`https://${trimmed.replace(/^\/+/, "")}`);
}

function hostnameOf(origin: string) {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isPreviewOrLocalHost(hostname: string) {
  return (
    !hostname ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".vercel.app")
  );
}

/** Canonical production origin for sitemap, robots, metadata, and JSON-LD. */
export const PRODUCTION_ORIGIN = "https://www.tradeflock.net";

/**
 * Public site origin used in canonical/OG/sitemap URLs.
 * Never returns localhost or Vercel preview hosts.
 */
export function getBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    const origin = withHttps(configured);
    if (!isPreviewOrLocalHost(hostnameOf(origin))) return origin;
  }

  return PRODUCTION_ORIGIN;
}

export function getSiteHost() {
  try {
    return new URL(getBaseUrl()).host;
  } catch {
    return "www.tradeflock.net";
  }
}
