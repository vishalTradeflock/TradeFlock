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
  magazine_id?: string | null;
  magazine_sort?: number | null;
  magazine_page?: number | null;
  designation?: string | null;
  subheading?: string | null;
  company?: string | null;
  bio?: string | null;
  linkedin_url?: string | null;
  website_url?: string | null;
  flipbook_url?: string | null;
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

export type MagazineHonoree = {
  name: string;
  designation?: string | null;
  company?: string | null;
  bio?: string | null;
  photo_url?: string | null;
  linkedin_url?: string | null;
  website_url?: string | null;
  page?: number | null;
  magazine_page?: number | null;
  slug?: string | null;
};

export type Magazine = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  pdf_url: string;
  flipbook_url: string;
  honorees: MagazineHonoree[];
  published_at: string;
  year: number | null;
  status: "draft" | "published";
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
