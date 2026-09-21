import { TARGETED_NOINDEX_PATHS } from "./targeted-noindex-paths.ts";

export const TARGETED_NOINDEX_HEADER_VALUE = "noindex, follow";
export const TARGETED_NOINDEX_META_CONTENT = "noindex,follow";

const TARGETED_NOINDEX_PATH_SET = new Set<string>(TARGETED_NOINDEX_PATHS);

export function normalizeNoindexPath(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = /^[a-zA-Z][a-zA-Z+\-.]*:/.test(trimmed)
      ? new URL(trimmed)
      : new URL(trimmed, "https://www.tradeflock.net");
    const pathname = decodeURIComponent(url.pathname).replace(/\/+$/, "") || "/";
    if (!pathname.startsWith("/")) return null;
    return pathname;
  } catch {
    return null;
  }
}

export function shouldNoindexPath(pathname: string) {
  const normalized = normalizeNoindexPath(pathname);
  if (!normalized) return false;
  return TARGETED_NOINDEX_PATH_SET.has(normalized);
}

export function targetedNoindexMetadata(pathname: string) {
  if (!shouldNoindexPath(pathname)) return {};
  return {
    robots: {
      index: false as const,
      follow: true as const,
    },
  };
}

export function targetedNoindexHeaders() {
  const headers = [{ key: "X-Robots-Tag", value: TARGETED_NOINDEX_HEADER_VALUE }];
  return TARGETED_NOINDEX_PATHS.flatMap((path) =>
    [path, `${path}/`].map((source) => ({ source, headers })),
  );
}
