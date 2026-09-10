import { SEED_ARTICLES } from "@/lib/data/seed";
import { createClient } from "@/lib/supabase/server";
import type { ArticleWithRelations, Author, Category } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/utils";

const ARTICLE_SELECT = `
  id,
  slug,
  title,
  dek,
  excerpt,
  body,
  cover_image_url,
  cover_image_alt,
  category_id,
  author_id,
  is_featured,
  is_breaking,
  view_count,
  published_at,
  category:categories (*),
  author:authors (*)
`;

function sortByPublished(a: ArticleWithRelations, b: ArticleWithRelations) {
  return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
}

async function fetchFromSupabase(): Promise<ArticleWithRelations[] | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("articles")
      .select(ARTICLE_SELECT)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false });

    if (error || !data?.length) return null;

    return data.map((row) => {
      const category = row.category as Category;
      const author = row.author as Author;
      return {
        ...(row as unknown as ArticleWithRelations),
        category,
        author,
      };
    });
  } catch {
    return null;
  }
}

export async function getArticles(categorySlug?: string) {
  const rows = (await fetchFromSupabase()) ?? SEED_ARTICLES;
  const published = [...rows].sort(sortByPublished);
  if (!categorySlug) return published;
  return published.filter((article) => article.category.slug === categorySlug);
}

export async function getArticleBySlug(slug: string) {
  const articles = await getArticles();
  return articles.find((article) => article.slug === slug) ?? null;
}

export async function getBreakingArticles() {
  const articles = await getArticles();
  const breaking = articles.filter((article) => article.is_breaking);
  return breaking.length ? breaking : articles.slice(0, 3);
}

export async function getMostRead(limit = 5) {
  const articles = await getArticles();
  return [...articles].sort((a, b) => b.view_count - a.view_count).slice(0, limit);
}

export async function getRelatedArticles(article: ArticleWithRelations, limit = 5) {
  const articles = await getArticles();
  const sameDesk = articles.filter(
    (item) => item.category.slug === article.category.slug && item.id !== article.id,
  );
  const filler = articles.filter((item) => item.id !== article.id && !sameDesk.includes(item));
  return [...sameDesk, ...filler].slice(0, limit);
}

export async function getHomeLayout(categorySlug?: string) {
  const articles = await getArticles(categorySlug);
  const featured = articles.find((article) => article.is_featured) ?? articles[0];
  const secondary = articles.filter((article) => article.id !== featured?.id).slice(0, 4);
  const mostRead = (await getMostRead(5)).filter((article) =>
    categorySlug ? article.category.slug === categorySlug : true,
  );
  const latest = articles.filter(
    (article) =>
      article.id !== featured?.id && !secondary.some((item) => item.id === article.id),
  );

  return { featured, secondary, mostRead, latest, articles };
}
