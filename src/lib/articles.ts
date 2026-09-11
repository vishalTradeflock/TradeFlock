import { cache } from "react";
import { SEED_ARTICLES } from "@/lib/data/seed";
import { assignDistinctCovers, resolveCoverImage } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";
import type { ArticleWithRelations, Author, Category } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/utils";

const LIST_LIMIT = 80;
const HOME_EDITORIAL_LIMIT = 250;

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
    const supabase = await createClient();
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
    const supabase = await createClient();
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

export const getEditorialArticles = cache(async (limit = HOME_EDITORIAL_LIMIT) => {
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
  const articles = await getEditorialArticles();
  const deepDives = articles.filter((article) =>
    ["markets", "finance", "tech", "leadership"].includes(article.category.slug),
  );
  const source = deepDives.length >= 6 ? deepDives : articles;
  return source.slice(0, limit);
}

export async function getHomeLayout(categorySlug?: string) {
  const articles = categorySlug
    ? await getArticles(categorySlug, HOME_EDITORIAL_LIMIT)
    : await getEditorialArticles(HOME_EDITORIAL_LIMIT);
  const featured = articles.find((article) => article.is_featured) ?? articles[0];
  let secondary = articles.filter((article) => article.id !== featured?.id).slice(0, 10);
  if (secondary.length < 8) {
    const extras = (
      categorySlug
        ? await getArticles(undefined, HOME_EDITORIAL_LIMIT)
        : await getEditorialArticles(HOME_EDITORIAL_LIMIT)
    ).filter(
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
