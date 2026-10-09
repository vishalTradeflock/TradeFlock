import type { MetadataRoute } from "next";
import { SEED_ARTICLES } from "@/lib/data/seed";
import { SEED_MAGAZINES } from "@/lib/data/seed-magazines";
import {
  buildSitemap,
  isUndefinedColumn,
  SITEMAP_MAX_URLS,
  sourceOrFallback,
  type SitemapArticleRow,
  type SitemapMagazineRow,
} from "@/lib/sitemap-entries";
import { PRODUCTION_ORIGIN } from "@/lib/site-url";
import { createPublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/utils";

/** Regenerate at most every 15 minutes so newly published stories reach the sitemap. */
export const revalidate = 900;
/** Headroom for a slow article page if the platform default is only a few seconds. */
export const maxDuration = 60;

const BASE_URL = PRODUCTION_ORIGIN;
const PAGE_SIZE = 1000;
/** One PostgREST call. Parallel pages share this budget; a hang must not outlive the function. */
const SITEMAP_QUERY_TIMEOUT_MS = 8_000;
const PAGE_BATCH = 3;

type SelectMode = "full" | "published" | "slug";

type PageResult = {
  rows: SitemapArticleRow[];
  error: { code?: string; message?: string } | null;
};

function logSitemapFailure(source: string, error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : "request failed";
  console.error(`[sitemap] ${source} unavailable (${message})`);
}

function seedArticles(): SitemapArticleRow[] {
  return SEED_ARTICLES.map((article) => ({
    slug: article.slug,
    updated_at: article.published_at,
    published_at: article.published_at,
  }));
}

function seedMagazines(): SitemapMagazineRow[] {
  return SEED_MAGAZINES.filter((magazine) => magazine.status !== "draft").map((magazine) => ({
    slug: magazine.slug,
    published_at: magazine.published_at,
    status: magazine.status,
  }));
}

function articleRows(
  data:
    | {
        slug: string | null;
        updated_at?: string | null;
        published_at?: string | null;
      }[]
    | null,
): SitemapArticleRow[] {
  const rows: SitemapArticleRow[] = [];
  for (const row of data ?? []) {
    if (typeof row.slug !== "string" || !row.slug) continue;
    rows.push({
      slug: row.slug,
      updated_at: row.updated_at,
      published_at: row.published_at,
    });
  }
  return rows;
}

function downgradeSelect(mode: SelectMode): SelectMode | null {
  if (mode === "full") return "published";
  if (mode === "published") return "slug";
  return null;
}

async function fetchArticlePage(
  supabase: ReturnType<typeof createPublicClient>,
  mode: SelectMode,
  from: number,
): Promise<PageResult> {
  const rangeEnd = from + PAGE_SIZE - 1;
  try {
    if (mode === "full") {
      const { data, error } = await supabase
        .from("articles")
        .select("slug, updated_at, published_at")
        .eq("status", "published")
        .not("slug", "is", null)
        .order("published_at", { ascending: false })
        .range(from, rangeEnd);
      if (error) return { rows: [], error };
      return { rows: articleRows(data), error: null };
    }
    if (mode === "published") {
      const { data, error } = await supabase
        .from("articles")
        .select("slug, published_at")
        .eq("status", "published")
        .not("slug", "is", null)
        .order("published_at", { ascending: false })
        .range(from, rangeEnd);
      if (error) return { rows: [], error };
      return { rows: articleRows(data), error: null };
    }
    const { data, error } = await supabase
      .from("articles")
      .select("slug")
      .eq("status", "published")
      .not("slug", "is", null)
      .range(from, rangeEnd);
    if (error) return { rows: [], error };
    return { rows: articleRows(data), error: null };
  } catch (error) {
    return {
      rows: [],
      error: { message: error instanceof Error ? error.message : "article query failed" },
    };
  }
}

/**
 * Pages of published articles. A transport failure keeps rows already loaded.
 * Only a missing column downgrades the select; timeouts do not fan out into
 * extra queries that can run past the function limit.
 */
async function paginatePublishedArticles(): Promise<{ rows: SitemapArticleRow[]; failed: boolean }> {
  const supabase = createPublicClient({ timeoutMs: SITEMAP_QUERY_TIMEOUT_MS });
  const rows: SitemapArticleRow[] = [];
  let from = 0;
  let selectMode: SelectMode = "full";

  while (from < SITEMAP_MAX_URLS) {
    const starts: number[] = [];
    for (let index = 0; index < PAGE_BATCH && from + index * PAGE_SIZE < SITEMAP_MAX_URLS; index += 1) {
      starts.push(from + index * PAGE_SIZE);
    }
    const pages = await Promise.all(
      starts.map((start) => fetchArticlePage(supabase, selectMode, start)),
    );
    if (pages.some((page) => page.error && isUndefinedColumn(page.error))) {
      const next = downgradeSelect(selectMode);
      if (!next) return { rows, failed: true };
      selectMode = next;
      continue;
    }

    for (const page of pages) {
      if (page.error) return { rows, failed: true };
      rows.push(...page.rows);
      if (page.rows.length < PAGE_SIZE) return { rows, failed: false };
    }
    from += starts.length * PAGE_SIZE;
  }

  return { rows, failed: false };
}

async function publishedArticles(): Promise<SitemapArticleRow[]> {
  if (!isSupabaseConfigured()) return seedArticles();
  try {
    const { rows, failed } = await paginatePublishedArticles();
    if (failed && rows.length === 0) return seedArticles();
    if (failed) logSitemapFailure("articles", { message: "partial article page" });
    return rows;
  } catch (error) {
    logSitemapFailure("articles", error);
    return seedArticles();
  }
}

async function publishedMagazines(): Promise<SitemapMagazineRow[]> {
  if (!isSupabaseConfigured()) return seedMagazines();
  try {
    const supabase = createPublicClient({ timeoutMs: SITEMAP_QUERY_TIMEOUT_MS });
    const full = await supabase
      .from("magazines")
      .select("slug, published_at, status")
      .order("published_at", { ascending: false })
      .limit(1000);
    if (!full.error) {
      return (full.data ?? []).map((row) => ({
        slug: row.slug,
        published_at: row.published_at,
        status: row.status,
      }));
    }
    if (!isUndefinedColumn(full.error)) {
      logSitemapFailure("magazines", full.error);
      return seedMagazines();
    }

    const narrow = await supabase
      .from("magazines")
      .select("slug, published_at")
      .order("published_at", { ascending: false })
      .limit(1000);
    if (narrow.error) {
      logSitemapFailure("magazines", narrow.error);
      return seedMagazines();
    }
    return (narrow.data ?? []).map((row) => ({
      slug: row.slug,
      published_at: row.published_at,
    }));
  } catch (error) {
    logSitemapFailure("magazines", error);
    return seedMagazines();
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const [articlesResult, magazinesResult] = await Promise.allSettled([
      publishedArticles(),
      publishedMagazines(),
    ]);
    if (articlesResult.status === "rejected") logSitemapFailure("articles", articlesResult.reason);
    if (magazinesResult.status === "rejected") logSitemapFailure("magazines", magazinesResult.reason);
    return buildSitemap(
      sourceOrFallback(articlesResult, seedArticles()),
      sourceOrFallback(magazinesResult, seedMagazines()),
      BASE_URL,
    );
  } catch (error) {
    logSitemapFailure("route", error);
    return buildSitemap(seedArticles(), seedMagazines(), BASE_URL);
  }
}
