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

export const NAV_CATEGORIES = [
  { name: "Tech", slug: "tech" },
  { name: "Markets", slug: "markets" },
  { name: "Leadership", slug: "leadership" },
  { name: "Finance", slug: "finance" },
] as const;
