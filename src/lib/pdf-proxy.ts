const ALLOWED_HOSTS = new Set([
  "www.tradeflockusa.com",
  "tradeflockusa.com",
  "www.tradeflock.net",
  "tradeflock.net",
  "mozilla.github.io",
]);

export function isAllowedPdfHost(hostname: string) {
  if (ALLOWED_HOSTS.has(hostname)) return true;
  if (hostname.endsWith(".tradeflockusa.com")) return true;
  if (hostname.endsWith(".supabase.co")) return true;
  return false;
}

export function proxiedPdfUrl(pdfUrl: string) {
  if (!pdfUrl.trim()) return "";
  try {
    const parsed = new URL(pdfUrl);
    if (parsed.protocol !== "https:") return "";
    const path = `/api/pdf-proxy?url=${encodeURIComponent(parsed.toString())}`;
    if (typeof window !== "undefined") {
      return `${window.location.origin}${path}`;
    }
    return path;
  } catch {
    return "";
  }
}
