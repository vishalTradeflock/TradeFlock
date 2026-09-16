import { revalidatePath } from "next/cache";
import { FALLBACK_COVER_IMAGE } from "@/lib/images";
import { fetchLegacyHonorees } from "@/lib/legacy-honorees";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type { Magazine, MagazineHonoree } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/utils";

type ArticleInsert = Database["public"]["Tables"]["articles"]["Insert"];

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function honoreeSlug(name: string, magazineSlug: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${base || "honoree"}-${magazineSlug}`.slice(0, 80);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function excerptFor(honoree: MagazineHonoree) {
  const bio = honoree.bio?.replace(/\s+/g, " ").trim() ?? "";
  if (bio) return bio.slice(0, 280);
  return [honoree.designation, honoree.company].filter(Boolean).join(" · ") || honoree.name;
}

async function resolveDeskIds(admin: ReturnType<typeof createAdminClient>) {
  const [{ data: categories }, { data: authors }] = await Promise.all([
    admin.from("categories").select("id, slug"),
    admin.from("authors").select("id, slug"),
  ]);

  const category =
    categories?.find((row) => row.slug === "leadership") ??
    categories?.find((row) => row.slug === "success-insights") ??
    categories?.[0];
  const author =
    authors?.find((row) => row.slug === "tradeflock") ??
    authors?.find((row) => row.slug === "elena-vasquez") ??
    authors?.[0];

  if (!category || !author) return null;
  return { categoryId: category.id, authorId: author.id };
}

function toInsertRows(
  magazine: Pick<Magazine, "id" | "slug" | "title" | "published_at">,
  honorees: MagazineHonoree[],
  desk: { categoryId: string; authorId: string },
): ArticleInsert[] {
  const publishedAt = magazine.published_at || new Date().toISOString();
  return honorees.map((honoree, index) => {
    const page = honoree.magazine_page ?? honoree.page ?? index * 2 + 4;
    const excerpt = excerptFor(honoree);
    const photo = honoree.photo_url?.trim() || FALLBACK_COVER_IMAGE;
    return {
      slug: honoree.slug?.trim() || honoreeSlug(honoree.name, magazine.slug),
      title: `${honoree.name} ${magazine.title}`.trim(),
      dek: [honoree.designation, honoree.company].filter(Boolean).join(" · ") || null,
      excerpt,
      body: honoree.bio ? `<p>${escapeHtml(honoree.bio)}</p>` : `<p>${escapeHtml(excerpt)}</p>`,
      cover_image_url: photo,
      cover_image_alt: honoree.name,
      category_id: desk.categoryId,
      author_id: desk.authorId,
      is_featured: index === 0,
      is_breaking: false,
      view_count: 0,
      status: "published",
      published_at: publishedAt,
      magazine_id: magazine.id,
      magazine_sort: index + 1,
      magazine_page: page,
      designation: honoree.designation ?? null,
      company: honoree.company ?? null,
      bio: honoree.bio ?? null,
      linkedin_url: honoree.linkedin_url ?? null,
    };
  });
}

export type SyncMagazineResult =
  | {
      ok: true;
      slug: string;
      count: number;
      honorees: string[];
    }
  | {
      ok: false;
      error: string;
      slug?: string;
    };

export async function syncMagazineFromLegacy(slug: string): Promise<SyncMagazineResult> {
  const clean = slug.trim().replace(/^\/+|\/+$/g, "");
  if (!clean || !/^[a-z0-9-]+$/.test(clean)) {
    return { ok: false, error: "Invalid magazine slug." };
  }
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "Supabase admin is not configured." };
  }

  const admin = createAdminClient();
  const { data: magazine, error: magazineError } = await admin
    .from("magazines")
    .select("id, slug, title, published_at")
    .eq("slug", clean)
    .maybeSingle();

  if (magazineError) {
    return { ok: false, error: magazineError.message, slug: clean };
  }
  if (!magazine || !UUID.test(magazine.id)) {
    return { ok: false, error: "Magazine not found.", slug: clean };
  }

  const honorees = await fetchLegacyHonorees(magazine.slug, magazine.title);
  if (!honorees.length) {
    return { ok: false, error: "No honorees parsed from the legacy edition.", slug: clean };
  }

  const desk = await resolveDeskIds(admin);
  if (!desk) {
    return { ok: false, error: "Missing author or category for magazine sync.", slug: clean };
  }

  const rows = toInsertRows(magazine, honorees, desk);
  const upsert = await admin.from("articles").upsert(rows, { onConflict: "slug" });
  if (upsert.error) {
    const stripped = rows.map(
      ({ magazine_id, magazine_sort, magazine_page, designation, company, bio, linkedin_url, ...rest }) => {
        void magazine_id;
        void magazine_sort;
        void magazine_page;
        void designation;
        void company;
        void bio;
        void linkedin_url;
        return rest;
      },
    );
    const retry = await admin.from("articles").upsert(stripped, { onConflict: "slug" });
    if (retry.error) {
      return { ok: false, error: retry.error.message, slug: clean };
    }
  }

  await admin
    .from("magazines")
    .update({
      honorees: honorees.map((honoree) => ({
        name: honoree.name,
        designation: honoree.designation ?? null,
        company: honoree.company ?? null,
        bio: honoree.bio ?? null,
        photo_url: honoree.photo_url ?? null,
        linkedin_url: honoree.linkedin_url ?? null,
        page: honoree.page ?? honoree.magazine_page ?? null,
        magazine_page: honoree.magazine_page ?? honoree.page ?? null,
        slug: honoree.slug ?? null,
      })),
    })
    .eq("id", magazine.id);

  revalidatePath(`/magazine/${magazine.slug}`);
  revalidatePath(`/magazine/${magazine.slug}/read`);

  return {
    ok: true,
    slug: magazine.slug,
    count: honorees.length,
    honorees: honorees.map((honoree) => honoree.name),
  };
}
