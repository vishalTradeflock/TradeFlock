export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

export type Author = {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  title: string | null;
  avatar_url: string | null;
};

export type Article = {
  id: string;
  slug: string;
  title: string;
  dek: string | null;
  excerpt: string;
  meta_title?: string | null;
  meta_description?: string | null;
  body: string;
  cover_image_url: string;
  cover_image_alt: string;
  category_id: string;
  author_id: string;
  is_featured: boolean;
  is_breaking: boolean;
  view_count: number;
  published_at: string;
};

export type ArticleWithRelations = Article & {
  category: Category;
  author: Author;
};

/** List-card fields only — never includes `body`. */
export type ArticleListCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_image_url: string;
  cover_image_alt: string;
  published_at: string;
  authorName: string;
  categoryName: string;
};

export type Magazine = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  pdf_url: string;
  published_at: string;
};

export const NAV_CATEGORIES = [
  { name: "Tech", slug: "tech" },
  { name: "Markets", slug: "markets" },
  { name: "Leadership", slug: "leadership" },
  { name: "Finance", slug: "finance" },
] as const;

export function sectionPath(slug: string) {
  const clean = slug.trim().toLowerCase();
  if (clean === "success-insights") return "/success-insights";
  if (NAV_CATEGORIES.some((category) => category.slug === clean)) {
    return `/${clean}`;
  }
  return "/";
}
