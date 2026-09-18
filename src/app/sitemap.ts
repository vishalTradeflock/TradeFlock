import type { MetadataRoute } from "next";
import { SEED_ARTICLES } from "@/lib/data/seed";
import { getMagazines } from "@/lib/magazines";
import { sitemapNewsPath } from "@/lib/sitemap-urls";
import { PRODUCTION_ORIGIN } from "@/lib/site-url";
import { createPublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/utils";

export const revalidate = 86400;

const BASE_URL = PRODUCTION_ORIGIN;
const PAGE_SIZE = 1000;
/** Leave headroom under the 50,000 URL sitemap cap so this can split later. */
const MAX_URLS = 45_000;

const DAILY_PATHS = [
  "/",
  "/tech",
  "/markets",
  "/leadership",
  "/finance",
  "/success-insights",
] as const;

const WEEKLY_PATHS = ["/magazine", "/magazine/all"] as const;

type SitemapRow = {
  slug: string;
  updated_at?: string | null;
  published_at?: string | null;
};

function absoluteUrl(path: string) {
  if (!path || path === "/") return BASE_URL;
  const pathname = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}${pathname}`;
}

function toIso(value?: string | Date | null) {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function staticPages(): MetadataRoute.Sitemap {
  const nowIso = toIso(new Date());
  return [
    ...DAILY_PATHS.map((path) => ({
      url: absoluteUrl(path),
      lastModified: nowIso,
      changeFrequency: "daily" as const,
      priority: path === "/" ? 1.0 : 0.8,
    })),
    ...WEEKLY_PATHS.map((path) => ({
      url: absoluteUrl(path),
      lastModified: nowIso,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}

async function paginatePublishedArticles(): Promise<SitemapRow[]> {
  const supabase = createPublicClient();
  const rows: SitemapRow[] = [];
  let from = 0;
  let selectMode: "full" | "published" | "slug" = "full";

  while (from < MAX_URLS) {
    const rangeEnd = from + PAGE_SIZE - 1;
    let page: SitemapRow[] = [];

    if (selectMode === "full") {
      const { data, error } = await supabase
        .from("articles")
        .select("slug, updated_at, published_at")
        .eq("status", "published")
        .not("slug", "is", null)
        .order("published_at", { ascending: false })
        .range(from, rangeEnd);
      if (error) {
        selectMode = "published";
        continue;
      }
      page = (data ?? []).map((row) => ({
        slug: row.slug,
        updated_at: row.updated_at,
        published_at: row.published_at,
      }));
    } else if (selectMode === "published") {
      const { data, error } = await supabase
        .from("articles")
        .select("slug, published_at")
        .eq("status", "published")
        .not("slug", "is", null)
        .order("published_at", { ascending: false })
        .range(from, rangeEnd);
      if (error) {
        selectMode = "slug";
        continue;
      }
      page = (data ?? []).map((row) => ({
        slug: row.slug,
        published_at: row.published_at,
      }));
    } else {
      const { data, error } = await supabase
        .from("articles")
        .select("slug")
        .eq("status", "published")
        .not("slug", "is", null)
        .range(from, rangeEnd);
      if (error || !data) break;
      page = data.map((row) => ({ slug: row.slug }));
    }

    if (!page.length) break;
    for (const row of page) {
      if (row.slug) rows.push(row);
    }
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function publishedArticles(): Promise<SitemapRow[]> {
  if (!isSupabaseConfigured()) {
    return SEED_ARTICLES.map((article) => ({
      slug: article.slug,
      updated_at: article.published_at,
      published_at: article.published_at,
    }));
  }

  try {
    return await paginatePublishedArticles();
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, magazines] = await Promise.all([
    publishedArticles(),
    getMagazines(),
  ]);

  const articleEntries: MetadataRoute.Sitemap = [];
  for (const article of articles) {
    const path = sitemapNewsPath(article.slug);
    if (!path) continue;
    articleEntries.push({
      url: `${BASE_URL}/news/${article.slug}`,
      lastModified: toIso(article.updated_at || article.published_at),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  const magazineEntries: MetadataRoute.Sitemap = magazines
    .filter((magazine) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(magazine.slug))
    .map((magazine) => ({
      url: `${BASE_URL}/magazine/${magazine.slug}`,
      lastModified: toIso(magazine.published_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  return [...staticPages(), ...articleEntries, ...magazineEntries].slice(0, MAX_URLS);
}
