import type { MetadataRoute } from "next";
import { SEED_ARTICLES } from "@/lib/data/seed";
import { getMagazines } from "@/lib/magazines";
import { listPublicAuthorSlugs, authorPath } from "@/lib/authors";
import { getCanonicalUrl, magazineIssueUrl, newsArticleUrl } from "@/lib/seo";
import { sitemapNewsPath } from "@/lib/sitemap-urls";
import { createPublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/utils";

export const revalidate = 86400;

const PAGE_SIZE = 1000;
/** Leave headroom under the 50,000 URL sitemap cap so this can split later. */
const MAX_URLS = 45_000;

const STATIC_PATHS = [
  "/",
  "/tech",
  "/markets",
  "/leadership",
  "/finance",
  "/success-insights",
  "/magazine",
  "/magazine/all",
  "/about",
  "/contact",
] as const;

function staticPages(now: Date): MetadataRoute.Sitemap {
  return STATIC_PATHS.map((path, index) => ({
    url: getCanonicalUrl(path),
    lastModified: now,
    changeFrequency: index === 0 ? "daily" : "weekly",
    priority: index === 0 ? 1 : 0.8,
  }));
}

type SitemapRow = {
  slug: string;
  updated_at?: string | null;
  published_at?: string | null;
};

function lastModified(row: SitemapRow) {
  const value = row.updated_at || row.published_at;
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function paginatePublishedArticles(): Promise<SitemapRow[]> {
  const supabase = createPublicClient();
  const now = new Date().toISOString();
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
        .lte("published_at", now)
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
        .lte("published_at", now)
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
  const now = new Date();
  const [articles, magazines, authorSlugs] = await Promise.all([
    publishedArticles(),
    getMagazines(),
    listPublicAuthorSlugs(),
  ]);

  const entries: MetadataRoute.Sitemap = [
    ...staticPages(now),
    ...articles.flatMap((article) => {
      const path = sitemapNewsPath(article.slug);
      if (!path) return [];
      return [
        {
          url: newsArticleUrl(article.slug),
          lastModified: lastModified(article) ?? now,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        },
      ];
    }),
    ...magazines.map((magazine) => ({
      url: magazineIssueUrl(magazine.slug),
      lastModified: lastModified({
        slug: magazine.slug,
        published_at: magazine.published_at,
      }) ?? now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...authorSlugs.map((slug) => ({
      url: getCanonicalUrl(authorPath(slug)),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];

  return entries.slice(0, MAX_URLS);
}
