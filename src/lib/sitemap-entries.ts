import type { MetadataRoute } from "next";
import { sitemapNewsPath } from "./sitemap-urls.ts";
import { PRODUCTION_ORIGIN } from "./site-url.ts";

const DAILY_PATHS = [
  "/",
  "/tech",
  "/markets",
  "/leadership",
  "/finance",
  "/success-insights",
] as const;

const WEEKLY_PATHS = ["/magazine", "/magazine/all"] as const;
const MONTHLY_PATHS = ["/about", "/contact"] as const;

/** Leave headroom under the 50,000 URL sitemap cap so this can split later. */
export const SITEMAP_MAX_URLS = 45_000;

export type SitemapArticleRow = {
  slug?: string | null;
  updated_at?: string | null;
  published_at?: string | null;
};

export type SitemapMagazineRow = {
  slug?: string | null;
  published_at?: string | null;
  status?: string | null;
};

const MAGAZINE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

export function sourceOrFallback<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

/** Missing-column errors can fall through to a narrower select. Timeouts must not. */
export function isUndefinedColumn(
  error: { code?: string; message?: string } | null | undefined,
) {
  if (!error) return false;
  const code = error.code ?? "";
  if (code === "42703" || code === "PGRST204") return true;
  const message = error.message ?? "";
  return /column/i.test(message) && /does not exist|schema cache/i.test(message);
}

function toIso(value?: string | Date | null) {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function absoluteUrl(origin: string, path: string) {
  if (!path || path === "/") return origin;
  const pathname = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${pathname}`;
}

export function isPublicSitemapUrl(origin: string, value: string) {
  try {
    const url = new URL(value);
    return url.origin === origin && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

function staticPages(origin: string): MetadataRoute.Sitemap {
  const nowIso = toIso(new Date());
  return [
    ...DAILY_PATHS.map((path) => ({
      url: absoluteUrl(origin, path),
      lastModified: nowIso,
      changeFrequency: "daily" as const,
      priority: path === "/" ? 1.0 : 0.8,
    })),
    ...WEEKLY_PATHS.map((path) => ({
      url: absoluteUrl(origin, path),
      lastModified: nowIso,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...MONTHLY_PATHS.map((path) => ({
      url: absoluteUrl(origin, path),
      lastModified: nowIso,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
  ];
}

function articleEntries(
  origin: string,
  articles: SitemapArticleRow[] | null | undefined,
): MetadataRoute.Sitemap {
  if (!Array.isArray(articles)) return [];
  const entries: MetadataRoute.Sitemap = [];
  for (const article of articles) {
    try {
      if (!article || typeof article.slug !== "string") continue;
      const path = sitemapNewsPath(article.slug);
      if (!path || path !== `/${article.slug}`) continue;
      const url = `${origin}/${article.slug}`;
      if (!isPublicSitemapUrl(origin, url)) continue;
      entries.push({
        url,
        lastModified: toIso(article.updated_at || article.published_at),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    } catch {
      continue;
    }
  }
  return entries;
}

function magazineEntries(
  origin: string,
  magazines: SitemapMagazineRow[] | null | undefined,
): MetadataRoute.Sitemap {
  if (!Array.isArray(magazines)) return [];
  const entries: MetadataRoute.Sitemap = [];
  for (const magazine of magazines) {
    try {
      if (!magazine || typeof magazine.slug !== "string") continue;
      if (magazine.status === "draft") continue;
      if (!MAGAZINE_SLUG.test(magazine.slug)) continue;
      const url = `${origin}/magazine/${magazine.slug}`;
      if (!isPublicSitemapUrl(origin, url)) continue;
      entries.push({
        url,
        lastModified: toIso(magazine.published_at),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    } catch {
      continue;
    }
  }
  return entries;
}

export function buildSitemap(
  articles: SitemapArticleRow[] | null | undefined,
  magazines: SitemapMagazineRow[] | null | undefined,
  origin = PRODUCTION_ORIGIN,
): MetadataRoute.Sitemap {
  try {
    return [...staticPages(origin), ...articleEntries(origin, articles), ...magazineEntries(origin, magazines)].slice(
      0,
      SITEMAP_MAX_URLS,
    );
  } catch {
    return staticPages(origin);
  }
}
