import { cache } from "react";
import { SEED_MAGAZINES } from "@/lib/data/seed-magazines";
import type { Database } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/public";
import type { Magazine } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/utils";

type MagazineRow = Database["public"]["Tables"]["magazines"]["Row"] & {
  dek?: string | null;
  file_url?: string | null;
  source_url?: string | null;
};

function sortByPublished(a: Magazine, b: Magazine) {
  return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
}

function asMagazine(row: MagazineRow): Magazine {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? row.dek ?? null,
    cover_image_url: row.cover_image_url ?? null,
    pdf_url: row.pdf_url ?? row.file_url ?? row.source_url ?? "",
    published_at: row.published_at,
  };
}

export const getMagazines = cache(async (): Promise<Magazine[]> => {
  if (!isSupabaseConfigured()) {
    return [...SEED_MAGAZINES].sort(sortByPublished);
  }

  try {
    const supabase = createPublicClient();
    const { data: magazines, error } = await supabase
      .from("magazines")
      .select("*")
      .order("published_at", { ascending: false });

    if (error) return [...SEED_MAGAZINES].sort(sortByPublished);
    return (magazines ?? []).map((row) => asMagazine(row));
  } catch {
    return [...SEED_MAGAZINES].sort(sortByPublished);
  }
});

export const getMagazineBySlug = cache(async (slug: string): Promise<Magazine | null> => {
  const clean = slug.trim().replace(/^\/+|\/+$/g, "");
  if (!clean) return null;

  if (!isSupabaseConfigured()) {
    return SEED_MAGAZINES.find((magazine) => magazine.slug === clean) ?? null;
  }

  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("magazines")
      .select("*")
      .eq("slug", clean)
      .maybeSingle();

    if (error) {
      return SEED_MAGAZINES.find((magazine) => magazine.slug === clean) ?? null;
    }
    return data ? asMagazine(data) : null;
  } catch {
    return SEED_MAGAZINES.find((magazine) => magazine.slug === clean) ?? null;
  }
});
