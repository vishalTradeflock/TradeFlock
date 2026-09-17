import { firstPartyMediaUrl } from "./media-proxy.ts";
import { isValidPublicSlug } from "./studio/slug.ts";
import { articlePath } from "./types.ts";

export function sitemapNewsPath(slug: string) {
  const trimmed = slug.trim();
  if (!trimmed || trimmed.endsWith("-") || !isValidPublicSlug(trimmed)) return null;
  const path = articlePath(trimmed);
  if (!path.startsWith("/news/") || path === "/news/") return null;
  if (path.slice("/news/".length).includes("/")) return null;
  return path;
}

export function sitemapImageUrl(source: string | null | undefined) {
  return firstPartyMediaUrl(source);
}
