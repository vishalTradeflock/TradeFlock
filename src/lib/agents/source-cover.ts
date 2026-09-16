import { isHttpsCoverUrl } from "@/lib/images";

const OG_TIMEOUT_MS = 4_000;
const SKIP_OG_HOSTS = /(^|\.)sec\.gov$/i;

function metaContent(html: string, key: "og:image" | "twitter:image"): string | null {
  const property = key === "og:image" ? "property" : "name";
  const patterns = [
    new RegExp(
      `<meta[^>]+${property}=["']${key}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+${property}=["']${key}["']`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return value;
  }
  return null;
}

/** Best-effort og:image from the source page. Never invents a URL; returns null on timeout/block. */
export async function fetchOgImageUrl(pageUrl: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(pageUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (SKIP_OG_HOSTS.test(parsed.hostname)) return null;

  try {
    const response = await fetch(pageUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(OG_TIMEOUT_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "TradeFlock USA newsroom@tradeflock-usa-nine.vercel.app",
      },
    });
    if (!response.ok) return null;
    const html = await response.text();
    const raw = metaContent(html, "og:image") ?? metaContent(html, "twitter:image");
    if (!raw) return null;
    const absolute = new URL(raw, pageUrl).toString();
    return isHttpsCoverUrl(absolute) ? absolute : null;
  } catch {
    return null;
  }
}
