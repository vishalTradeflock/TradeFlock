import { cache } from "react";
import { BIG_TAKE_LIMIT, HOME_ARTICLE_LIMIT } from "@/lib/cache";
import { SEED_ARTICLES } from "@/lib/data/seed";
import { assignDistinctCovers, articleCoverSrc, portraitImageUrl } from "@/lib/images";
import { parseArticleFaqs } from "@/lib/seo";
import { createPublicClient } from "@/lib/supabase/public";
import type { ArticleListCard, ArticleWithRelations, Author, Category } from "@/lib/types";
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
  "author:authors(id,name,slug,title,avatar_url,bio)",
].join(",");

const ARTICLE_DETAIL_SELECT = `${ARTICLE_LIST_SELECT},body`;
const ARTICLE_DETAIL_SEO_SELECT = `${ARTICLE_DETAIL_SELECT},meta_title,meta_description`;
const ARTICLE_DETAIL_TECH_SELECT = `${ARTICLE_DETAIL_SEO_SELECT},canonical_url,faqs,featured_image,featured_image_alt,image_url,updated_at`;

type ArticleDetailMode = "tech" | "seo" | "base";
let articleDetailMode: ArticleDetailMode = "tech";

function missingSeoColumn(message: string | undefined) {
  const haystack = (message ?? "").toLowerCase();
  return haystack.includes("meta_title") || haystack.includes("meta_description");
}

function missingTechSeoColumn(message: string | undefined) {
  const haystack = (message ?? "").toLowerCase();
  return /canonical_url|faqs|featured_image|image_url/.test(haystack);
}

function articleDetailSelect() {
  if (articleDetailMode === "tech") return ARTICLE_DETAIL_TECH_SELECT;
  if (articleDetailMode === "seo") return ARTICLE_DETAIL_SEO_SELECT;
  return ARTICLE_DETAIL_SELECT;
}

function downgradeArticleDetailSelect(message: string | undefined) {
  if (articleDetailMode === "tech" && missingTechSeoColumn(message)) {
    articleDetailMode = "seo";
    return true;
  }
  if (articleDetailMode !== "base" && missingSeoColumn(message)) {
    articleDetailMode = "base";
    return true;
  }
  return false;
}

type ArticleRow = Record<string, unknown> & {
  category?: Category | Category[] | null;
  categories?: Category | Category[] | null;
  author?: Author | Author[] | null;
  body?: string | null;
  cover_image_url?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  canonical_url?: string | null;
  featured_image?: string | null;
  featured_image_alt?: string | null;
  image_url?: string | null;
  faqs?: unknown;
  updated_at?: string | null;
};

type ListQuery = {
  categorySlug?: string;
  categoryName?: string;
  categoryId?: string;
  categoryIds?: string[];
  authorId?: string;
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
  const category = asRelation(row.category) ?? asRelation(row.categories);
  const author = asRelation(row.author);
  if (!category || !author) return null;

  const article = row as unknown as ArticleWithRelations;
  return {
    ...article,
    body: includeBody ? String(row.body ?? "") : "",
    cover_image_url: articleCoverSrc({
      id: article.id,
      title: article.title,
      slug: article.slug,
      cover_image_url: article.cover_image_url,
      category,
    }),
    meta_title: typeof row.meta_title === "string" && row.meta_title.trim() ? row.meta_title : null,
    meta_description:
      typeof row.meta_description === "string" && row.meta_description.trim()
        ? row.meta_description
        : null,
    canonical_url:
      typeof row.canonical_url === "string" && row.canonical_url.trim() ? row.canonical_url : null,
    featured_image:
      typeof row.featured_image === "string" && row.featured_image.trim()
        ? row.featured_image
        : null,
    featured_image_alt:
      typeof row.featured_image_alt === "string" && row.featured_image_alt.trim()
        ? row.featured_image_alt
        : null,
    image_url: typeof row.image_url === "string" && row.image_url.trim() ? row.image_url : null,
    updated_at: typeof row.updated_at === "string" && row.updated_at.trim() ? row.updated_at : null,
    faqs: parseArticleFaqs(row.faqs),
    category,
    author,
  };
}

function withListCovers(articles: ArticleWithRelations[]) {
  return assignDistinctCovers(
    articles.map((article) => ({
      ...article,
      cover_image_url: articleCoverSrc(article),
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
    if (options.authorId) {
      request = request.eq("author_id", options.authorId);
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

export const getPublishedArticlesByAuthorId = cache(async (authorId: string, limit = 60) => {
  if (!authorId) return [];
  const rows =
    (await queryList({ authorId, limit })) ??
    filterSeed({ limit }).filter((article) => article.author.id === authorId);
  return withListCovers(rows);
});

export async function resolvePublishedSlugRedirect(oldSlug: string) {
  const clean = normalizeArticleSlug(oldSlug);
  if (!clean || !isSupabaseConfigured()) return null;

  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("article_slug_redirects")
      .select("article_id")
      .eq("old_slug", clean)
      .maybeSingle();
    if (error || !data?.article_id) return null;

    const article = await supabase
      .from("articles")
      .select("slug, status, published_at")
      .eq("id", data.article_id)
      .maybeSingle();
    if (article.error || !article.data) return null;
    if (article.data.status !== "published") return null;
    if (article.data.published_at && article.data.published_at > new Date().toISOString()) {
      return null;
    }
    const next = article.data.slug?.trim();
    if (!next || next === clean) return null;
    return next;
  } catch {
    return null;
  }
}

function missingArticleColumn(message: string | undefined, column: string) {
  return (message ?? "").toLowerCase().includes(column);
}

const MAGAZINE_STORY_SELECTS = [
  `${ARTICLE_LIST_SELECT},magazine_sort,designation,subheading,linkedin_url,website_url,flipbook_url,magazine_page,company,bio,featured_image`,
  `${ARTICLE_LIST_SELECT},magazine_sort,designation,subheading,linkedin_url,website_url,flipbook_url,magazine_page,company,bio`,
  `${ARTICLE_LIST_SELECT},magazine_sort,designation,subheading,linkedin_url,website_url,flipbook_url,magazine_page,company`,
  `${ARTICLE_LIST_SELECT},magazine_sort,designation,subheading`,
  `${ARTICLE_LIST_SELECT},magazine_sort`,
  ARTICLE_LIST_SELECT,
];

function seedArticlesForMagazine(magazineId: string) {
  return SEED_ARTICLES.filter((article) => article.magazine_id === magazineId).sort(
    (a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime(),
  );
}

function sortMagazineHonorees(articles: ArticleWithRelations[]) {
  return [...articles].sort((a, b) => {
    const pageA = a.magazine_page ?? a.magazine_sort ?? 10_000;
    const pageB = b.magazine_page ?? b.magazine_sort ?? 10_000;
    if (pageA !== pageB) return pageA - pageB;
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
    const sortA = a.magazine_sort ?? 10_000;
    const sortB = b.magazine_sort ?? 10_000;
    if (sortA !== sortB) return sortA - sortB;
    return new Date(a.published_at).getTime() - new Date(b.published_at).getTime();
  });
}

async function articlesLinkedByMagazineId(
  supabase: ReturnType<typeof createPublicClient>,
  magazineId: string,
  now: string,
) {
  if (!magazineId) return [];

  for (const select of MAGAZINE_STORY_SELECTS) {
    let request = supabase
      .from("articles")
      .select(select)
      .eq("magazine_id", magazineId)
      .eq("status", "published")
      .lte("published_at", now)
      .limit(40);

    if (select.includes("magazine_page")) {
      request = request.order("magazine_page", { ascending: true, nullsFirst: false });
    } else if (select.includes("magazine_sort")) {
      request = request.order("magazine_sort", { ascending: true, nullsFirst: false });
    }

    const byRelation = await request.order("published_at", { ascending: true });
    if (byRelation.error) {
      if (missingArticleColumn(byRelation.error.message, "magazine_id")) return [];
      continue;
    }
    return byRelation.data ?? [];
  }

  return [];
}

/** Honoree stories explicitly assigned to this issue. */
export const getArticlesLinkedToMagazine = cache(async (magazine: {
  id: string;
  slug?: string;
}) => {
  const magazineId = magazine.id.trim();
  if (!magazineId) return [] as ArticleWithRelations[];
  if (!isSupabaseConfigured()) {
    return sortMagazineHonorees(seedArticlesForMagazine(magazineId));
  }

  try {
    const supabase = createPublicClient();
    const rows = await articlesLinkedByMagazineId(supabase, magazineId, new Date().toISOString());
    return sortMagazineHonorees(mapMagazineArticles(rows));
  } catch {
    return [];
  }
});

export const getArticlesByMagazineId = cache(async (magazine: {
  id: string;
  slug: string;
  title?: string;
}) => {
  const magazineId = magazine.id.trim();
  const magazineSlug = magazine.slug.trim().replace(/^\/+|\/+$/g, "");
  if (!magazineId && !magazineSlug) return [] as ArticleWithRelations[];
  if (!isSupabaseConfigured()) {
    return magazineId ? sortMagazineHonorees(seedArticlesForMagazine(magazineId)) : [];
  }

  try {
    const supabase = createPublicClient();
    const now = new Date().toISOString();
    const byId = new Map<string, unknown>();

    const remember = (rows: unknown[] | null | undefined) => {
      for (const row of rows ?? []) {
        const record = row as { id?: string };
        if (record.id) byId.set(record.id, row);
      }
    };

    remember(await articlesLinkedByMagazineId(supabase, magazineId, now));
    if (byId.size) {
      return sortMagazineHonorees(mapMagazineArticles([...byId.values()]));
    }

    remember(await articlesMatchingMagazineSlug(supabase, magazineSlug, now));

    const issueTitle = magazine.title?.trim();
    if (issueTitle) {
      remember(await articlesMatchingMagazineTitle(supabase, issueTitle, now));
    }
    remember(await articlesMatchingMagazineTitle(supabase, magazineSlug.replace(/-/g, " "), now));
    remember(await articlesMatchingMagazineCategory(supabase, magazineSlug, issueTitle, now));

    return sortMagazineHonorees(mapMagazineArticles([...byId.values()]));
  } catch {
    return [];
  }
});

async function articlesMatchingMagazineSlug(
  supabase: ReturnType<typeof createPublicClient>,
  magazineSlug: string,
  now: string,
) {
  if (!magazineSlug || !/^[a-z0-9-]+$/.test(magazineSlug)) return [];

  for (const select of MAGAZINE_STORY_SELECTS) {
    const { data, error } = await supabase
      .from("articles")
      .select(select)
      .eq("status", "published")
      .lte("published_at", now)
      .ilike("slug", `%${magazineSlug}%`)
      .order("published_at", { ascending: true })
      .limit(40);

    if (error) continue;
    return data ?? [];
  }

  return [];
}

async function articlesMatchingMagazineCategory(
  supabase: ReturnType<typeof createPublicClient>,
  magazineSlug: string,
  magazineTitle: string | undefined,
  now: string,
) {
  const titleNeedle = (magazineTitle ?? magazineSlug.replace(/-/g, " "))
    .replace(/[%*,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!magazineSlug && titleNeedle.length < 8) return [];

  const filters = [
    magazineSlug && /^[a-z0-9-]+$/.test(magazineSlug) ? `slug.eq.${magazineSlug}` : "",
    titleNeedle.length >= 8 ? `name.ilike.%${titleNeedle}%` : "",
  ].filter(Boolean);
  if (!filters.length) return [];

  for (const select of MAGAZINE_STORY_SELECTS) {
    const inner = select.replace("category:categories(", "category:categories!inner(");
    const { data, error } = await supabase
      .from("articles")
      .select(inner)
      .eq("status", "published")
      .lte("published_at", now)
      .or(filters.join(","), { foreignTable: "categories" })
      .order("published_at", { ascending: true })
      .limit(40);

    if (error) continue;
    return data ?? [];
  }

  return [];
}

async function articlesMatchingMagazineTitle(
  supabase: ReturnType<typeof createPublicClient>,
  title: string,
  now: string,
) {
  const needle = title.replace(/[%*,()]/g, " ").replace(/\s+/g, " ").trim();
  if (needle.length < 8) return [];

  for (const select of MAGAZINE_STORY_SELECTS) {
    const { data, error } = await supabase
      .from("articles")
      .select(select)
      .eq("status", "published")
      .lte("published_at", now)
      .ilike("title", `%${needle}%`)
      .order("published_at", { ascending: true })
      .limit(40);

    if (error) continue;
    return data ?? [];
  }

  return [];
}

function firstHttpsUrl(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("/")) return trimmed;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "https:") return trimmed;
    } catch {
      /* try next */
    }
  }
  return "";
}

function mapMagazineArticles(rows: unknown[] | null | undefined): ArticleWithRelations[] {
  if (!rows?.length) return [];
  const articles: ArticleWithRelations[] = [];
  for (const raw of rows) {
    const row = raw as ArticleRow & {
      id?: string;
      slug?: string;
      title?: string;
      dek?: string | null;
      excerpt?: string | null;
      cover_image_alt?: string | null;
      featured_image?: string | null;
      cover_image?: string | null;
      designation?: string | null;
      subheading?: string | null;
      company?: string | null;
      bio?: string | null;
      linkedin_url?: string | null;
      website_url?: string | null;
      flipbook_url?: string | null;
      magazine_sort?: number | null;
      magazine_page?: number | null;
      is_featured?: boolean;
      is_breaking?: boolean;
      view_count?: number;
      published_at?: string;
      category_id?: string;
      author_id?: string;
    };
    const mapped = mapArticleRow(row, false);
    const slug = String(row.slug ?? mapped?.slug ?? "").trim();
    const title = String(row.title ?? mapped?.title ?? "").trim();
    if (!slug || !title) continue;

    const fallbackCategory = mapped?.category ?? {
      id: "magazine-issue",
      name: "Magazine",
      slug: "magazine",
      description: null,
    };
    const fallbackAuthor = mapped?.author ?? {
      id: "tradeflock-desk",
      name: "TradeFlock",
      slug: "tradeflock",
      bio: null,
      title: null,
      avatar_url: null,
    };

    articles.push({
      id: String(row.id ?? mapped?.id ?? slug),
      slug,
      title,
      dek: typeof row.dek === "string" ? row.dek : mapped?.dek ?? null,
      excerpt: typeof row.excerpt === "string" ? row.excerpt : mapped?.excerpt ?? "",
      body: mapped?.body ?? "",
      cover_image_url:
        portraitImageUrl(row.featured_image, row.cover_image, row.cover_image_url) ?? "",
      cover_image_alt:
        typeof row.cover_image_alt === "string" ? row.cover_image_alt : mapped?.cover_image_alt || "",
      category_id: String(row.category_id ?? mapped?.category_id ?? fallbackCategory.id),
      author_id: String(row.author_id ?? mapped?.author_id ?? fallbackAuthor.id),
      is_featured: Boolean(row.is_featured ?? mapped?.is_featured),
      is_breaking: Boolean(row.is_breaking ?? mapped?.is_breaking),
      view_count: Number(row.view_count ?? mapped?.view_count ?? 0),
      published_at: String(row.published_at ?? mapped?.published_at ?? new Date().toISOString()),
      magazine_id: mapped?.magazine_id ?? null,
      magazine_sort: typeof row.magazine_sort === "number" ? row.magazine_sort : null,
      magazine_page: typeof row.magazine_page === "number" ? row.magazine_page : null,
      designation: typeof row.designation === "string" ? row.designation : mapped?.designation ?? null,
      subheading: typeof row.subheading === "string" ? row.subheading : mapped?.subheading ?? null,
      company: typeof row.company === "string" ? row.company : mapped?.company ?? null,
      bio: typeof row.bio === "string" ? row.bio : mapped?.bio ?? null,
      linkedin_url: firstHttpsUrl(row.linkedin_url, mapped?.linkedin_url) || null,
      website_url: firstHttpsUrl(row.website_url, mapped?.website_url) || null,
      flipbook_url: firstHttpsUrl(row.flipbook_url, mapped?.flipbook_url) || null,
      category: fallbackCategory,
      author: fallbackAuthor,
    });
  }
  return articles;
}

/** Category desks: match slug first, then display name, then common aliases. */
export const getCategoryDesk = cache(async (slugOrName: string, limit = LIST_LIMIT) => {
  const raw = slugOrName.trim();
  const slug = raw.toLowerCase().replace(/\s+/g, "-");
  const slugAliases =
    slug === "technology" || slug === "tech" ? ["tech", "technology"] : [slug];

  for (const alias of slugAliases) {
    const rows = await getArticles(alias, limit);
    if (rows.length) return rows;
  }

  const names = new Set<string>([raw, raw.replace(/-/g, " ")]);
  if (slug === "tech" || slug === "technology") {
    names.add("Tech");
    names.add("Technology");
  }

  for (const name of names) {
    const fromDb = await queryList({ categoryName: name, limit });
    if (fromDb?.length) return withListCovers(fromDb);
    const seeded = filterSeed({ categoryName: name, limit });
    if (seeded.length) return withListCovers(seeded);
  }

  return [];
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
      .select(articleDetailSelect())
      .eq("status", "published")
      .eq("slug", cleanSlug)
      .lte("published_at", now)
      .maybeSingle();

    if (downgradeArticleDetailSelect(exact.error?.message)) {
      return fetchArticleBySlugFromSupabase(cleanSlug);
    }

    if (!exact.error && exact.data) {
      return mapArticleRow(exact.data as unknown as ArticleRow, true);
    }

    for (const variant of slugFallbacks(cleanSlug)) {
      if (variant === cleanSlug) continue;

      const retry = await supabase
        .from("articles")
        .select(articleDetailSelect())
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
      .select(articleDetailSelect())
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
    cover_image_url: articleCoverSrc(seed),
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

const ARCHIVE_SELECT = [
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
  "categories!inner(id,name,slug)",
  "author:authors(id,name,slug,title,avatar_url,bio)",
].join(",");

/** Full Success Insights archive — list fields only, bypasses the 100-row PostgREST cap. */
export const getSuccessInsightsArchive = cache(async () => {
  const seedRows = () =>
    withListCovers(
      dedupeArticles([
        ...filterSeed({ categoryName: SUCCESS_INSIGHTS_NAME, limit: 1000 }),
        ...filterSeed({ categorySlug: SUCCESS_INSIGHTS_SLUG, limit: 1000 }),
      ]),
    );

  if (!isSupabaseConfigured()) return seedRows();

  try {
    const supabase = createPublicClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("articles")
      .select(ARCHIVE_SELECT)
      .eq("status", "published")
      .lte("published_at", now)
      .or("slug.eq.success-insights,name.ilike.%success insights%", {
        foreignTable: "categories",
      })
      .order("published_at", { ascending: false })
      .range(0, 999);

    const fromJoin =
      !error && data?.length
        ? data
            .map((row) => mapArticleRow(row as unknown as ArticleRow, false))
            .filter((row): row is ArticleWithRelations => Boolean(row))
        : [];

    if (fromJoin.length) return withListCovers(dedupeArticles(fromJoin));

    const ids = await getSuccessInsightsCategoryIds();
    if (ids.length) {
      const byId = await supabase
        .from("articles")
        .select(ARTICLE_LIST_SELECT)
        .eq("status", "published")
        .lte("published_at", now)
        .in("category_id", ids)
        .order("published_at", { ascending: false })
        .range(0, 999);

      const mapped =
        !byId.error && byId.data?.length
          ? byId.data
              .map((row) => mapArticleRow(row as unknown as ArticleRow, false))
              .filter((row): row is ArticleWithRelations => Boolean(row))
          : [];
      if (mapped.length) return withListCovers(dedupeArticles(mapped));
    }
  } catch {
    /* fall through to seed */
  }

  return seedRows();
});

export const getBreakingArticles = cache(async () => {
  const rows =
    (await queryList({ breaking: true, limit: 5 })) ?? filterSeed({ breaking: true, limit: 5 });
  const source = rows.length ? rows : ((await queryList({ limit: 3 })) ?? filterSeed({ limit: 3 }));
  return withListCovers(source.slice(0, 3));
});

export function toArticleListCard(article: ArticleWithRelations): ArticleListCard {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    cover_image_url: article.cover_image_url,
    cover_image_alt: article.cover_image_alt,
    published_at: article.published_at,
    authorName: article.author.name,
    categoryName: article.category.name,
  };
}

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
  const articles = categorySlug
    ? await getArticles(categorySlug, HOME_ARTICLE_LIMIT)
    : await getEditorialArticles(HOME_ARTICLE_LIMIT);
  const { editorialArticles, successInsightsArticles } = partitionHomeArticles(articles);
  const pool = editorialArticles.length ? editorialArticles : articles;
  const featured = pool.find((article) => article.is_featured) ?? pool[0];
  const mostRead = [...pool]
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, 5);
  const deskTake = pool.filter((article) =>
    ["markets", "finance", "tech", "leadership"].includes(article.category.slug),
  );
  const bigTake = (deskTake.length >= 5 ? deskTake : pool).slice(0, BIG_TAKE_LIMIT);
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

export async function getBigTake(limit = BIG_TAKE_LIMIT) {
  const { bigTake } = await getHomeLayout();
  return bigTake.slice(0, limit);
}

