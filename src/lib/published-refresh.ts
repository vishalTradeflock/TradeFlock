/**
 * Pages that render the latest-news Breaking ticker (home passes the editorial
 * list; the others call `getBreakingArticles()` because their own list is empty
 * or is Success Insights). Home also carries the news rails and the Success
 * Insights middle scroller.
 *
 * Story URLs are not in this list. Invalidating every article page would send
 * crawlers back to the origin after each publish.
 */
export const LATEST_NEWS_SURFACES = [
  "/",
  "/about",
  "/contact",
  "/standards",
  "/success-insights",
  "/magazine",
  "/magazine/all",
] as const;

const NAV_SECTION_SLUGS = new Set(["tech", "markets", "leadership", "finance"]);

export type PublishedRefreshTarget = {
  articleSlugs?: Iterable<string | null | undefined>;
  /** Category slugs already known to the caller. `technology` maps to `/tech`. */
  sectionSlugs?: Iterable<string | null | undefined>;
  authorSlugs?: Iterable<string | null | undefined>;
  magazineSlugs?: Iterable<string | null | undefined>;
  /**
   * Refresh home and the other latest-news ticker pages.
   * Publish, edit, unpublish, delete, and magazine sync leave this on.
   */
  listings?: boolean;
};

export function sectionPathsForCategory(slug: string | null | undefined): string[] {
  const clean = String(slug ?? "").trim().toLowerCase();
  if (!clean) return [];
  if (clean === "tech" || clean === "technology") return ["/tech"];
  if (clean === "success-insights" || clean === "success insights") return ["/success-insights"];
  if (NAV_SECTION_SLUGS.has(clean)) return [`/${clean}`];
  return [];
}

function cleanSlug(value: string | null | undefined) {
  const clean = String(value ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (!clean || clean.includes("/") || clean.includes("?") || clean.includes("#")) return null;
  return clean;
}

/** Relation embed from a PostgREST select, object or single-element array. */
export function nestedSlug(value: unknown): string | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  const slug = "slug" in row ? row.slug : null;
  return typeof slug === "string" ? cleanSlug(slug) : null;
}

export function publishedRefreshPaths(target: PublishedRefreshTarget = {}): string[] {
  const paths = new Set<string>();
  if (target.listings !== false) {
    for (const path of LATEST_NEWS_SURFACES) paths.add(path);
  }

  for (const slug of target.articleSlugs ?? []) {
    const clean = cleanSlug(slug);
    if (clean) paths.add(`/${clean}`);
  }
  for (const slug of target.sectionSlugs ?? []) {
    for (const path of sectionPathsForCategory(slug)) paths.add(path);
  }
  for (const slug of target.authorSlugs ?? []) {
    const clean = cleanSlug(slug);
    if (clean) paths.add(`/author/${clean}`);
  }
  for (const slug of target.magazineSlugs ?? []) {
    const clean = cleanSlug(slug);
    if (!clean || !/^[a-z0-9-]+$/i.test(clean)) continue;
    paths.add(`/magazine/${clean}`);
    paths.add(`/magazine/${clean}/read`);
  }

  return [...paths];
}
