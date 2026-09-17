import type { MetadataRoute } from "next";
import { SEED_ARTICLES } from "@/lib/data/seed";
import { SEED_MAGAZINES } from "@/lib/data/seed-magazines";
import { absoluteUrl, magazineIssueUrl, newsArticleUrl } from "@/lib/seo";
import { getBaseUrl } from "@/lib/site-url";
import { createPublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/utils";

export const revalidate = 86400;

const PAGE_SIZE = 1000;

function staticPages(now: Date): MetadataRoute.Sitemap {
  return [
    { url: getBaseUrl(), lastModified: now, changeFrequency: "daily", priority: 1 },
    {
      url: absoluteUrl("/magazine"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/leadership"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/tech"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/finance"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];
}

type SitemapRow = {
  slug: string;
  updated_at?: string | null;
  published_at?: string | null;
  status?: string | null;
};

function lastModified(row: SitemapRow) {
  const value = row.updated_at || row.published_at;
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function paginateArticles(): Promise<SitemapRow[]> {
  const supabase = createPublicClient();
  const rows: SitemapRow[] = [];
  let from = 0;

  while (from < 20_000) {
    const { data, error } = await supabase
      .from("articles")
      .select("slug, updated_at")
      .eq("status", "published")
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data?.length) break;
    for (const row of data) {
      rows.push({
        slug: row.slug,
        updated_at: row.updated_at,
      });
    }
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows.filter((row) => row.slug);
}

async function paginateMagazines(publishedOnly: boolean): Promise<SitemapRow[]> {
  const supabase = createPublicClient();
  const rows: SitemapRow[] = [];
  let from = 0;

  while (from < 20_000) {
    const query = supabase.from("magazines").select("slug, updated_at, status").range(
      from,
      from + PAGE_SIZE - 1,
    );
    const { data, error } = publishedOnly
      ? await query.eq("status", "published")
      : await query;
    if (error || !data?.length) break;
    for (const row of data) {
      rows.push({
        slug: row.slug,
        updated_at: row.updated_at,
        status: row.status,
      });
    }
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows.filter((row) => row.slug);
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
    const rows = await paginateArticles();
    if (rows.length) return rows;
  } catch {
    /* fall through */
  }

  return SEED_ARTICLES.map((article) => ({
    slug: article.slug,
    updated_at: article.published_at,
    published_at: article.published_at,
  }));
}

async function publishedMagazines(): Promise<SitemapRow[]> {
  if (!isSupabaseConfigured()) {
    return SEED_MAGAZINES.filter((magazine) => magazine.status !== "draft").map((magazine) => ({
      slug: magazine.slug,
      updated_at: magazine.published_at,
      published_at: magazine.published_at,
    }));
  }

  try {
    const rows = await paginateMagazines(true);
    if (rows.length) return rows;
    const unfiltered = await paginateMagazines(false);
    return unfiltered.filter((row) => row.status !== "draft");
  } catch {
    /* fall through */
  }

  return SEED_MAGAZINES.filter((magazine) => magazine.status !== "draft").map((magazine) => ({
    slug: magazine.slug,
    updated_at: magazine.published_at,
    published_at: magazine.published_at,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, magazines] = await Promise.all([publishedArticles(), publishedMagazines()]);

  return [
    ...staticPages(new Date()),
    ...articles.map((article) => ({
      url: newsArticleUrl(article.slug),
      lastModified: lastModified(article),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...magazines.map((magazine) => ({
      url: magazineIssueUrl(magazine.slug),
      lastModified: lastModified(magazine),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
