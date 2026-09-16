import { existsSync } from "node:fs";
import path from "node:path";
import { cache } from "react";
import { SEED_MAGAZINES } from "@/lib/data/seed-magazines";
import { parseMagazineHonorees } from "@/lib/magazine-honorees";
import { usableHttpUrl } from "@/lib/magazine-links";
import type { Database } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/public";
import type { Magazine } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/utils";

type MagazineRow = Database["public"]["Tables"]["magazines"]["Row"] & {
  dek?: string | null;
  file_url?: string | null;
  source_url?: string | null;
  year?: number | null;
  status?: string | null;
  cover_image?: string | null;
  flipbook_url?: string | null;
  honorees?: unknown;
};

function sortByPublished(a: Magazine, b: Magazine) {
  return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
}

function issueYear(publishedAt: string, year?: number | null) {
  if (typeof year === "number" && Number.isFinite(year)) return year;
  const parsed = new Date(publishedAt).getFullYear();
  return Number.isFinite(parsed) ? parsed : null;
}

export function usableCoverUrl(url: string | null | undefined) {
  const trimmed = url?.trim() ?? "";
  if (!trimmed || /^(null|undefined|none|n\/a)$/i.test(trimmed)) return null;
  if (trimmed.startsWith("/covers/") && /\.(jpe?g|webp|png)$/i.test(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

function localIssueCover(slug: string) {
  for (const ext of [".jpg", ".jpeg", ".webp", ".png"] as const) {
    const file = `/covers/${slug}${ext}`;
    if (existsSync(path.join(process.cwd(), "public", file.slice(1)))) {
      return file;
    }
  }
  return null;
}

function magazineCover(row: MagazineRow) {
  return (
    usableCoverUrl(row.cover_image) ??
    usableCoverUrl(row.cover_image_url) ??
    localIssueCover(row.slug)
  );
}

function asMagazine(row: MagazineRow): Magazine {
  const publishedAt = row.published_at;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? row.dek ?? null,
    cover_image_url: magazineCover(row),
    pdf_url: row.pdf_url ?? row.file_url ?? row.source_url ?? "",
    flipbook_url: usableHttpUrl(row.flipbook_url) ?? "",
    honorees: parseMagazineHonorees(row.honorees),
    published_at: publishedAt,
    year: issueYear(publishedAt, row.year),
    status: row.status === "draft" ? "draft" : "published",
  };
}

function publishedOnly(magazines: Magazine[]) {
  return magazines.filter((magazine) => magazine.status !== "draft");
}

async function queryMagazines(slug?: string): Promise<{
  data: MagazineRow[] | MagazineRow | null;
  failed: boolean;
}> {
  const supabase = createPublicClient();
  const selects = ["*,honorees,cover_image,cover_image_url", "*,honorees", "*"];

  for (const select of selects) {
    const request = slug
      ? supabase.from("magazines").select(select).eq("slug", slug).maybeSingle()
      : supabase.from("magazines").select(select).order("published_at", { ascending: false });
    const { data, error } = await request;
    if (!error) return { data: data as MagazineRow[] | MagazineRow | null, failed: false };
  }

  return { data: null, failed: true };
}

export const getMagazines = cache(async (): Promise<Magazine[]> => {
  if (!isSupabaseConfigured()) {
    return publishedOnly([...SEED_MAGAZINES].sort(sortByPublished));
  }

  try {
    const { data, failed } = await queryMagazines();
    if (failed || data == null) return publishedOnly([...SEED_MAGAZINES].sort(sortByPublished));
    const list = Array.isArray(data) ? data : [data];
    return publishedOnly(list.map((row) => asMagazine(row)));
  } catch {
    return publishedOnly([...SEED_MAGAZINES].sort(sortByPublished));
  }
});

export const getMagazineBySlug = cache(async (slug: string): Promise<Magazine | null> => {
  const clean = slug.trim().replace(/^\/+|\/+$/g, "");
  if (!clean) return null;

  const fromSeed = () => {
    const seeded = SEED_MAGAZINES.find((magazine) => magazine.slug === clean) ?? null;
    return seeded && seeded.status !== "draft" ? seeded : null;
  };

  if (!isSupabaseConfigured()) return fromSeed();

  try {
    const { data, failed } = await queryMagazines(clean);
    if (failed) return fromSeed();
    if (data == null) return null;
    const row = (Array.isArray(data) ? data[0] : data) ?? null;
    if (!row) return null;
    const magazine = asMagazine(row);
    if (magazine.status === "draft") return null;
    return magazine;
  } catch {
    return fromSeed();
  }
});
