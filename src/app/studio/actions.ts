"use server";

import { revalidatePath } from "next/cache";
import { FALLBACK_COVER_IMAGE } from "@/lib/images";
import {
  authorSlugFromEmail,
  coverFromHtml,
  excerptFromHtml,
  slugifyTitle,
} from "@/lib/studio/copy";
import { requireStudioSession, type StudioRole } from "@/lib/studio/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sanitizeArticleBody } from "@/lib/sanitize-article-body";

export type SaveDraftInput = {
  id?: string | null;
  title: string;
  body: string;
  categoryId: string;
  status?: "draft" | "review" | "published";
};

export type SaveDraftResult =
  | { ok: true; id: string; slug: string; status: "draft" | "review" | "published" }
  | { ok: false; error: string };

async function ensureAuthorId(session: {
  userId: string;
  email: string | null;
  profile: { author_id: string | null; display_name: string | null };
}) {
  if (session.profile.author_id) return session.profile.author_id;

  const admin = createAdminClient();
  const name = session.profile.display_name?.trim() || session.email?.split("@")[0] || "Staff Writer";
  const slugBase = authorSlugFromEmail(session.email ?? `${session.userId}@studio`);
  let slug = slugBase;
  let attempt = 0;

  while (attempt < 5) {
    const { data, error } = await admin
      .from("authors")
      .insert({ name, slug, title: "Staff Writer" })
      .select("id")
      .single();

    if (!error && data?.id) {
      await admin.from("profiles").update({ author_id: data.id }).eq("id", session.userId);
      return data.id;
    }

    attempt += 1;
    slug = `${slugBase}-${attempt + 1}`;
  }

  throw new Error("Could not attach an author record.");
}

function canPublish(role: StudioRole, nextStatus: "draft" | "review" | "published") {
  if (nextStatus === "published") return role === "admin";
  return true;
}

export async function saveStudioDraft(input: SaveDraftInput): Promise<SaveDraftResult> {
  try {
    const session = await requireStudioSession();
    const requested = input.status;

    const title = input.title.trim() || "Untitled draft";
    const rawBody = input.body.trim();
    const body = sanitizeArticleBody(rawBody, { title });
    const excerpt = excerptFromHtml(body);
    const cover_image_url = coverFromHtml(body) || FALLBACK_COVER_IMAGE;
    const cover_image_alt = title;

    const admin = createAdminClient();
    const authorId = await ensureAuthorId(session);

    if (input.id) {
      const { data: existing, error: existingError } = await admin
        .from("articles")
        .select("id, slug, status, author_id")
        .eq("id", input.id)
        .maybeSingle();

      if (existingError || !existing) return { ok: false, error: "Draft not found." };
      if (
        existing.author_id !== authorId &&
        session.profile.role !== "admin" &&
        session.profile.role !== "editor"
      ) {
        return { ok: false, error: "You cannot edit this draft." };
      }

      const nextStatus = requested ?? existing.status;
      if (!canPublish(session.profile.role, nextStatus)) {
        return { ok: false, error: "Only an editor-in-chief can publish." };
      }

      const update: {
        title: string;
        body: string;
        excerpt: string;
        cover_image_url: string;
        cover_image_alt: string;
        category_id: string;
        status: "draft" | "review" | "published";
        published_at?: string;
      } = {
        title,
        body,
        excerpt,
        cover_image_url,
        cover_image_alt,
        category_id: input.categoryId,
        status: nextStatus,
      };

      if (nextStatus === "published") {
        update.published_at = new Date().toISOString();
      }

      const { error } = await admin.from("articles").update(update).eq("id", existing.id);
      if (error) return { ok: false, error: error.message };

      if (nextStatus === "published") {
        revalidatePath("/", "layout");
        revalidatePath(`/news/${existing.slug}`);
      }

      return { ok: true, id: existing.id, slug: existing.slug, status: nextStatus };
    }

    const nextStatus = requested ?? "draft";
    if (!canPublish(session.profile.role, nextStatus)) {
      return { ok: false, error: "Only an editor-in-chief can publish." };
    }

    const slug = slugifyTitle(title);
    const { data, error } = await admin
      .from("articles")
      .insert({
        slug,
        title,
        excerpt,
        body,
        cover_image_url,
        cover_image_alt,
        category_id: input.categoryId,
        author_id: authorId,
        status: nextStatus,
        published_at:
          nextStatus === "published"
            ? new Date().toISOString()
            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id, slug, status")
      .single();

    if (error || !data) return { ok: false, error: error?.message ?? "Could not save draft." };

    if (nextStatus === "published") {
      revalidatePath("/", "layout");
      revalidatePath(`/news/${data.slug}`);
    }

    return { ok: true, id: data.id, slug: data.slug, status: data.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save draft.";
    return { ok: false, error: message };
  }
}

export async function signOutStudio() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
