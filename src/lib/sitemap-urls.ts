import { firstPartyMediaUrl } from "./media-proxy.ts";
import { isValidPublicSlug } from "./studio/slug.ts";
import { RESERVED_ROOT_SLUGS, articlePath } from "./types.ts";

const PLACEHOLDER_SLUG =
  /(?:^|-)(?:placeholder|test|testing|dummy|sample|untitled|lorem|asdf)(?:-|$)/i;

export function isPlaceholderSitemapSlug(slug: string) {
  return PLACEHOLDER_SLUG.test(slug.trim());
}

export function sitemapNewsPath(slug: string) {
  const trimmed = slug.trim();
  if (!trimmed || trimmed.endsWith("-") || !isValidPublicSlug(trimmed)) return null;
  if (isPlaceholderSitemapSlug(trimmed)) return null;
  if (RESERVED_ROOT_SLUGS.has(trimmed.toLowerCase())) return null;
  const path = articlePath(trimmed);
  if (!path.startsWith("/") || path === "/") return null;
  if (path.slice(1).includes("/")) return null;
  return path;
}

export function sitemapImageUrl(source: string | null | undefined) {
  return firstPartyMediaUrl(source);
}
