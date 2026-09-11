import { cache } from "react";
import { HOME_ARTICLE_LIMIT } from "@/lib/cache";
import { SEED_ARTICLES } from "@/lib/data/seed";
import { assignDistinctCovers, resolveCoverImage } from "@/lib/images";
import { createPublicClient } from "@/lib/supabase/public";
import type { ArticleWithRelations, Author, Category } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/utils";

const LIST_LIMIT = HOME_ARTICLE_LIMIT;

export const SUCCESS_INSIGHTS_SLUG = "success-insights";
export const SUCCESS_INSIGHTS_NAME = "Success Insights";

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
  categoryName?: string;
  categoryId?: string;
  categoryIds?: string[];
  excludeId?: string;
  excludeCategoryIds?: string[];
  excludeSuccessInsights?: boolean;
  breaking?: boolean;
  order?: "published_at" | "view_count";
  limit?: number;
};

function dedupeArticles(articles: ArticleWithRelations[]) {
  const seen = new Set<string>();
  const unique: ArticleWithRelations[] = [];
  for (const article of articles) {
    if (seen.has(article.id)) continue;
    seen.add(article.id);
    unique.push(article);
  }
  return unique;
}

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
  if (options.categoryName) {
    const name = options.categoryName.trim().toLowerCase();
    rows = rows.filter((article) => article.category.name.trim().toLowerCase() === name);
  }
  if (options.excludeSuccessInsights) {
    rows = rows.filter((article) => !isSuccessInsightsArticle(article));
  }
  if (options.excludeCategoryIds?.length) {
    rows = rows.filter((article) => !options.excludeCategoryIds?.includes(article.category_id));
  }
  if (options.categoryId) {
    rows = rows.filter((article) => article.category_id === options.categoryId);
  }
  if (options.categoryIds?.length) {
    rows = rows.filter((article) => options.categoryIds?.includes(article.category_id));
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
    const supabase = createPublicClient();
    const limit = options.limit ?? LIST_LIMIT;
    const order = options.order ?? "published_at";
    const needsCategoryInner =
      Boolean(options.categorySlug) ||
      Boolean(options.categoryName) ||
      Boolean(options.excludeSuccessInsights);
    const select = needsCategoryInner
      ? ARTICLE_LIST_SELECT.replace(
          "category:categories(",
          "category:categories!inner(",
        )
      : ARTICLE_LIST_SELECT;
    let request = supabase
      .from("articles")
      .select(select)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order(order, { ascending: false })
      .limit(limit);

    if (options.categorySlug) {
      request = request.eq("category.slug", options.categorySlug);
    }
    if (options.categoryName) {
      request = request.eq("category.name", options.categoryName);
    }
    if (options.excludeSuccessInsights) {
      request = request
        .neq("category.slug", SUCCESS_INSIGHTS_SLUG)
        .not("category.name", "ilike", SUCCESS_INSIGHTS_NAME);
    }
    if (options.excludeCategoryIds?.length) {
      request = request.not(
        "category_id",
        "in",
        `(${options.excludeCategoryIds.join(",")})`,
      );
    }
    if (options.categoryId) {
      request = request.eq("category_id", options.categoryId);
    }
    if (options.categoryIds?.length) {
      request = request.in("category_id", options.categoryIds);
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

const getSuccessInsightsCategoryIds = cache(async () => {
  if (!isSupabaseConfigured()) return [] as string[];
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase.from("categories").select("id,name,slug");
    if (error || !data?.length) return [] as string[];
    return data
      .filter((row) => {
        const slug = String(row.slug ?? "").trim().toLowerCase();
        const name = String(row.name ?? "").trim().toLowerCase();
        return slug === SUCCESS_INSIGHTS_SLUG || name === "success insights";
      })
      .map((row) => String(row.id));
  } catch {
    return [] as string[];
  }
});

export const getEditorialArticles = cache(async (limit = HOME_ARTICLE_LIMIT) => {
  const siIds = await getSuccessInsightsCategoryIds();
  const queried =
    (await queryList({
      excludeCategoryIds: siIds.length ? siIds : undefined,
      excludeSuccessInsights: siIds.length === 0,
      limit,
    })) ??
    ((await queryList({ limit: Math.min(limit + 150, 400) })) ?? []).filter(
      (article) => !isSuccessInsightsArticle(article),
    );
  const rows = queried.length
    ? queried.slice(0, limit)
    : filterSeed({ excludeSuccessInsights: true, limit });
  return withListCovers(rows.filter((article) => !isSuccessInsightsArticle(article)));
});

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
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("articles")
      .select("slug")
      .eq("status", "published")
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
    const supabase = createPublicClient();
    const now = new Date().toISOString();

    const exact = await supabase
      .from("articles")
      .select(ARTICLE_DETAIL_SELECT)
      .eq("status", "published")
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
        .eq("status", "published")
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
      .eq("status", "published")
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

export const getArticleBySlug = cache(async (slug: string) => {
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
});

export const getSuccessInsightsArticles = cache(async (limit = 20) => {
  const byName =
    (await queryList({ categoryName: SUCCESS_INSIGHTS_NAME, limit })) ?? [];
  const merged = dedupeArticles(byName);

  if (merged.length < limit) {
    const bySlug =
      (await queryList({ categorySlug: SUCCESS_INSIGHTS_SLUG, limit })) ?? [];
    merged.push(...bySlug.filter((article) => !merged.some((row) => row.id === article.id)));
  }

  if (merged.length < limit) {
    const ids = await getSuccessInsightsCategoryIds();
    if (ids.length) {
      const byId = (await queryList({ categoryIds: ids, limit })) ?? [];
      merged.push(...byId.filter((article) => !merged.some((row) => row.id === article.id)));
    }
  }

  const rows = merged.length
    ? merged.slice(0, limit)
    : dedupeArticles([
        ...filterSeed({ categoryName: SUCCESS_INSIGHTS_NAME, limit }),
        ...filterSeed({ categorySlug: SUCCESS_INSIGHTS_SLUG, limit }),
      ]).slice(0, limit);

  return withListCovers(rows);
});

export const getBreakingArticles = cache(async () => {
  const siIds = await getSuccessInsightsCategoryIds();
  const breakingRows =
    (await queryList({
      breaking: true,
      excludeCategoryIds: siIds.length ? siIds : undefined,
      excludeSuccessInsights: siIds.length === 0,
      limit: 8,
    })) ?? filterSeed({ breaking: true, excludeSuccessInsights: true, limit: 8 });
  const breaking = breakingRows.filter((article) => !isSuccessInsightsArticle(article));
  if (breaking.length) {
    return withListCovers(breaking.slice(0, 8));
  }

  const editorial = await getEditorialArticles(8);
  return editorial.slice(0, 8);
});

export const getRelatedArticles = cache(async (article: ArticleWithRelations, limit = 5) => {
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
});

export const getHomeLayout = cache(async (categorySlug?: string) => {
  const articles = await getArticles(categorySlug, HOME_ARTICLE_LIMIT);
  const { editorialArticles, successInsightsArticles } = partitionHomeArticles(articles);
  const pool = editorialArticles.length ? editorialArticles : articles;
  const featured = pool.find((article) => article.is_featured) ?? pool[0];
  const mostRead = [...pool]
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, 5);
  const deskTake = pool.filter((article) =>
    ["markets", "finance", "tech", "leadership"].includes(article.category.slug),
  );
  const bigTake = (deskTake.length >= 5 ? deskTake : pool).slice(0, 8);
  const secondary = pool.filter((article) => article.id !== featured?.id).slice(0, 10);
  const latest = pool.filter(
    (article) =>
      article.id !== featured?.id && !secondary.some((item) => item.id === article.id),
  );

  return {
    featured,
    secondary,
    mostRead,
    bigTake,
    latest,
    articles,
    editorialArticles,
    successInsightsArticles,
  };
});

export async function getMostRead(limit = 5, categorySlug?: string) {
  const { mostRead } = await getHomeLayout(categorySlug);
  return mostRead.slice(0, limit);
}

export async function getBigTake(limit = 8) {
  const { bigTake } = await getHomeLayout();
  return bigTake.slice(0, limit);
}

