import { articlePath } from "./types.ts";

/**
 * Decode and trim a requested /{slug} segment without stripping trailing
 * hyphens or generated keys. Redirect rows are stored as the exact old slug.
 */
export function exactRequestedArticleSlug(slug: string) {
  let decoded = slug.trim();
  try {
    decoded = decodeURIComponent(decoded).trim();
  } catch {
    /* keep trimmed raw slug */
  }
  return decoded.replace(/^\/+|\/+$/g, "");
}

export function publishedNewsRedirectLocation(toSlug: string) {
  return articlePath(toSlug.trim());
}

export type PublishedArticleRequestResult =
  | { kind: "redirect"; status: 308; location: string; toSlug: string }
  | { kind: "render"; status: 200 }
  | { kind: "not_found"; status: 404 };

/**
 * Exact `article_slug_redirects` rows win before any trailing-hyphen fallback
 * that would otherwise 200 the current article slug.
 */
export function resolvePublishedArticleRequest(input: {
  requestedSlug: string;
  redirectToSlug: string | null | undefined;
  articleFound: boolean;
}): PublishedArticleRequestResult {
  const requested = exactRequestedArticleSlug(input.requestedSlug);
  const toSlug = input.redirectToSlug?.trim() ?? "";
  if (toSlug && toSlug !== requested) {
    return {
      kind: "redirect",
      status: 308,
      toSlug,
      location: publishedNewsRedirectLocation(toSlug),
    };
  }
  if (input.articleFound) {
    return { kind: "render", status: 200 };
  }
  return { kind: "not_found", status: 404 };
}
