import { cache } from "react";
import { SEED_ARTICLES, SEED_AUTHORS } from "@/lib/data/seed";
import { createPublicClient } from "@/lib/supabase/public";
import type { Author } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/utils";

export function authorPath(slug: string) {
  const clean = slug.trim().replace(/^\/+|\/+$/g, "");
  return clean ? `/author/${clean}` : "/author/";
}

export const getAuthorBySlug = cache(async (slug: string): Promise<Author | null> => {
  const clean = slug.trim().replace(/^\/+|\/+$/g, "");
  if (!clean) return null;

  if (isSupabaseConfigured()) {
    try {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from("authors")
        .select("id, name, slug, bio, title, avatar_url")
        .eq("slug", clean)
        .maybeSingle();
      if (!error && data) return data;
    } catch {
      // Fall through to seed authors for local/dev.
    }
  }

  return SEED_AUTHORS.find((author) => author.slug === clean) ?? null;
});

export async function listPublicAuthorSlugs() {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createPublicClient();
      const now = new Date().toISOString();
      const authorIds = new Set<string>();
      let from = 0;
      const pageSize = 1000;

      while (from < 45_000) {
        const { data, error } = await supabase
          .from("articles")
          .select("author_id")
          .eq("status", "published")
          .lte("published_at", now)
          .range(from, from + pageSize - 1);
        if (error || !data?.length) break;
        for (const row of data) {
          if (row.author_id) authorIds.add(row.author_id);
        }
        if (data.length < pageSize) break;
        from += pageSize;
      }

      if (!authorIds.size) {
        return [...new Set(SEED_ARTICLES.map((article) => article.author.slug).filter(Boolean))];
      }

      const slugs = new Set<string>();
      const ids = [...authorIds];
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { data, error } = await supabase.from("authors").select("slug").in("id", chunk);
        if (error || !data) continue;
        for (const row of data) {
          if (row.slug?.trim()) slugs.add(row.slug.trim());
        }
      }
      return [...slugs];
    } catch {
      // Fall through to seed authors for local/dev.
    }
  }

  return [...new Set(SEED_ARTICLES.map((article) => article.author.slug).filter(Boolean))];
}
