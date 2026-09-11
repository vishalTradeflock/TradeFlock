import { cache } from "react";
import { SEED_ARTICLES } from "@/lib/data/seed";
import { assignDistinctCovers, resolveCoverImage } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";
import type { ArticleWithRelations, Author, Category } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/utils";

const LIST_LIMIT = 80;

/** Homepage/rails never select `body`. There is no `desk` column — category is joined instead. */
const ARTICLE_LIST_SELECT = [
  "id",
  "title",
  "slug",
  "dek",
  "excerpt",
  "cover_image_url",
  "cover_image_alt",
  "published_at",
  "category_id",
  "author_id",
  "view_count",
  "is_featured",
  "is_breaking",
  "category:categories(id,name,slug)",
  "author:authors(id,name,slug,title,avatar_url)",
].join(",");

const ARTICLE_DETAIL_SELECT = `${ARTICLE_LIST_SELECT},body`;

type ArticleRow = Record<string, unknown> & {
  category?: Category | Category[] | null;
  author?: Author | Author[] | null;
  body?: string | null;
  cover_image_url?: string | null;
};

type ListQuery = {
  categorySlug?: string;
  categoryId?: string;
  excludeId?: string;
  breaking?: boolean;
  order?: "published_at" | "view_count";
  limit?: number;
};

function sortByPublished(a: ArticleWithRelations, b: ArticleWithRelations) {
  return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
}

function asRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapArticleRow(row: ArticleRow, includeBody: boolean): ArticleWithRelations | null {
  const category = asRelation(row.category as Category | Category[] | null);
  const author = asRelation(row.author as Author | Author[] | null);
  if (!category || !author) return null;

  const article = row as unknown as ArticleWithRelations;
  return {
    ...article,
    body: includeBody ? String(row.body ?? "") : "",
    cover_image_url: resolveCoverImage(article.cover_image_url),
    category,
    author,
  };
}

function withListCovers(articles: ArticleWithRelations[]) {
  return assignDistinctCovers(
    articles.map((article) => ({
      ...article,
      cover_image_url: resolveCoverImage(article.cover_image_url),
    })),
  );
}

export function normalizeArticleSlug(slug: string) {
  let decoded = slug.trim();
  try {
    decoded = decodeURIComponent(decoded).trim();
  } catch {
    /* keep trimmed raw slug */
  }
  return decoded.replace(/^\/+|\/+$/g, "");
}

function slugFallbacks(cleanSlug: string) {
  const trimmed = cleanSlug.replace(/-+$/g, "").replace(/^-+/g, "");
  const variants = [cleanSlug, trimmed, cleanSlug.toLowerCase(), trimmed.toLowerCase()];
  return [...new Set(variants.filter(Boolean))];
}

function findSeedBySlug(cleanSlug: string) {
  const variants = slugFallbacks(cleanSlug);
  return (
    SEED_ARTICLES.find((article) => variants.includes(article.slug)) ??
    SEED_ARTICLES.find((article) =>
      variants.some((variant) => article.slug.toLowerCase() === variant.toLowerCase()),
    ) ??
    null
  );
}

function filterSeed(options: ListQuery) {
  let rows = [...SEED_ARTICLES].sort(sortByPublished);
  if (options.categorySlug) {
    rows = rows.filter((article) => article.category.slug === options.categorySlug);
  }
  if (options.categoryId) {
    rows = rows.filter((article) => article.category_id === options.categoryId);
  }
  if (options.excludeId) {
    rows = rows.filter((article) => article.id !== options.excludeId);
  }
  if (options.breaking) {
    const breaking = rows.filter((article) => article.is_breaking);
    rows = breaking.length ? breaking : rows;
  }
  if (options.order === "view_count") {
    rows = [...rows].sort((a, b) => b.view_count - a.view_count);
  }
  return rows.slice(0, options.limit ?? LIST_LIMIT);
}

async function queryList(options: ListQuery): Promise<ArticleWithRelations[] | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createClient();
    const limit = options.limit ?? LIST_LIMIT;
    const order = options.order ?? "published_at";
    const select = options.categorySlug
      ? ARTICLE_LIST_SELECT.replace(
          "category:categories(",
          "category:categories!inner(",
        )
      : ARTICLE_LIST_SELECT;
    let request = supabase
      .from("articles")
      .select(select)
      .lte("published_at", new Date().toISOString())
      .order(order, { ascending: false })
      .limit(limit);

    if (options.categorySlug) {
      request = request.eq("category.slug", options.categorySlug);
    }
    if (options.categoryId) {
      request = request.eq("category_id", options.categoryId);
    }
    if (options.excludeId) {
      request = request.neq("id", options.excludeId);
    }
    if (options.breaking) {
      request = request.eq("is_breaking", true);
    }

    const { data, error } = await request;
    if (error || !data?.length) return null;

    const mapped = data
      .map((row) => mapArticleRow(row as unknown as ArticleRow, false))
      .filter((row): row is ArticleWithRelations => Boolean(row));

    return mapped.length ? mapped : null;
  } catch {
    return null;
  }
}

export const SUCCESS_INSIGHTS_SLUG = "success-insights";

export function isSuccessInsightsArticle(article: { category: { slug: string; name: string } }) {
  const slug = article.category.slug.trim().toLowerCase();
  const name = article.category.name.trim().toLowerCase();
  return slug === SUCCESS_INSIGHTS_SLUG || name === "success insights";
}

export function partitionHomeArticles(articles: ArticleWithRelations[]) {
  const editorialArticles: ArticleWithRelations[] = [];
  const successInsightsArticles: ArticleWithRelations[] = [];
  for (const article of articles) {
    if (isSuccessInsightsArticle(article)) {
      successInsightsArticles.push(article);
    } else {
      editorialArticles.push(article);
    }
  }
  return { editorialArticles, successInsightsArticles };
}

export const getArticles = cache(async (categorySlug?: string, limit = LIST_LIMIT) => {
  const rows =
    (await queryList({ categorySlug, limit })) ?? filterSeed({ categorySlug, limit });
  return withListCovers(rows);
});

export async function getArticleSlugs() {
  if (!isSupabaseConfigured()) {
    return SEED_ARTICLES.map((article) => article.slug);
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("articles")
      .select("slug")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(LIST_LIMIT);

    if (error || !data?.length) {
      return SEED_ARTICLES.map((article) => article.slug);
    }
    return data.map((row) => row.slug).filter(Boolean);
  } catch {
    return SEED_ARTICLES.map((article) => article.slug);
  }
}

async function fetchArticleBySlugFromSupabase(cleanSlug: string) {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createClient();
    const now = new Date().toISOString();

    const exact = await supabase
      .from("articles")
      .select(ARTICLE_DETAIL_SELECT)
      .eq("slug", cleanSlug)
      .lte("published_at", now)
      .maybeSingle();

    if (!exact.error && exact.data) {
      return mapArticleRow(exact.data as unknown as ArticleRow, true);
    }

    for (const variant of slugFallbacks(cleanSlug)) {
      if (variant === cleanSlug) continue;

      const retry = await supabase
        .from("articles")
        .select(ARTICLE_DETAIL_SELECT)
        .eq("slug", variant)
        .lte("published_at", now)
        .maybeSingle();

      if (!retry.error && retry.data) {
        return mapArticleRow(retry.data as unknown as ArticleRow, true);
      }
    }

    const insensitive = await supabase
      .from("articles")
      .select(ARTICLE_DETAIL_SELECT)
      .ilike(
        "slug",
        cleanSlug.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_"),
      )
      .lte("published_at", now)
      .limit(1)
      .maybeSingle();

    if (!insensitive.error && insensitive.data) {
      return mapArticleRow(insensitive.data as unknown as ArticleRow, true);
    }
  } catch {
    return null;
  }

  return null;
}

export async function getArticleBySlug(slug: string) {
  const cleanSlug = normalizeArticleSlug(slug);
  if (!cleanSlug) return null;

  const fromSupabase = await fetchArticleBySlugFromSupabase(cleanSlug);
  if (fromSupabase) return fromSupabase;

  if (isSupabaseConfigured()) return null;

  const seed = findSeedBySlug(cleanSlug);
  if (!seed) return null;
  return {
    ...seed,
    cover_image_url: resolveCoverImage(seed.cover_image_url),
  };
}

export async function getSuccessInsightsArticles(limit = 16) {
  return getArticles(SUCCESS_INSIGHTS_SLUG, limit);
}

export async function getBreakingArticles() {
  const rows =
    (await queryList({ breaking: true, limit: 5 })) ?? filterSeed({ breaking: true, limit: 5 });
  const source = rows.length ? rows : ((await queryList({ limit: 3 })) ?? filterSeed({ limit: 3 }));
  return withListCovers(source.slice(0, 3));
}

export async function getMostRead(limit = 5, categorySlug?: string) {
  const rows =
    (await queryList({ categorySlug, limit: limit + 8, order: "view_count" })) ??
    filterSeed({ categorySlug, limit: limit + 8, order: "view_count" });
  const editorial = categorySlug
    ? rows
    : rows.filter((article) => !isSuccessInsightsArticle(article));
  return withListCovers(editorial.slice(0, limit));
}

export async function getRelatedArticles(article: ArticleWithRelations, limit = 5) {
  const sameDesk =
    (await queryList({ categoryId: article.category_id, excludeId: article.id, limit })) ??
    filterSeed({ categoryId: article.category_id, excludeId: article.id, limit });

  if (sameDesk.length >= limit) return withListCovers(sameDesk.slice(0, limit));

  const filler =
    (await queryList({ excludeId: article.id, limit })) ??
    filterSeed({ excludeId: article.id, limit });
  const merged = [
    ...sameDesk,
    ...filler.filter((item) => !sameDesk.some((desk) => desk.id === item.id)),
  ].slice(0, limit);
  return withListCovers(merged);
}

export async function getBigTake(limit = 8) {
  const articles = await getArticles();
  const editorial = articles.filter((article) => !isSuccessInsightsArticle(article));
  const deepDives = editorial.filter((article) =>
    ["markets", "finance", "tech", "leadership"].includes(article.category.slug),
  );
  const source = deepDives.length >= 6 ? deepDives : editorial;
  return source.slice(0, limit);
}

export async function getHomeLayout(categorySlug?: string) {
  const articles = await getArticles(categorySlug, LIST_LIMIT);
  const featured = articles.find((article) => article.is_featured) ?? articles[0];
  let secondary = articles.filter((article) => article.id !== featured?.id).slice(0, 10);
  if (secondary.length < 8) {
    const extras = (await getArticles(undefined, LIST_LIMIT)).filter(
      (article) =>
        article.id !== featured?.id &&
        !secondary.some((item) => item.id === article.id),
    );
    secondary = [...secondary, ...extras].slice(0, 10);
  }
  const mostRead = await getMostRead(5, categorySlug);
  const latest = articles.filter(
    (article) =>
      article.id !== featured?.id && !secondary.some((item) => item.id === article.id),
  );

  return { featured, secondary, mostRead, latest, articles };
}
