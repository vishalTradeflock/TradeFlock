"use server";

import { revalidatePath } from "next/cache";
import { FALLBACK_COVER_IMAGE } from "@/lib/images";
import {
  coverFromHtml,
  excerptFromHtml,
  slugifyTitle,
  uniqueAuthorSlug,
} from "@/lib/studio/copy";
import { headers } from "next/headers";
import { canInviteStaff, canPublishArticle } from "@/lib/studio/access";
import { emptyToNull } from "@/lib/studio/seo";
import { isModerator, type StudioRole } from "@/lib/studio/roles";
import { getStudioSession } from "@/lib/studio/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sanitizeArticleBody } from "@/lib/sanitize-article-body";

export type SaveDraftInput = {
  id?: string | null;
  title: string;
  body: string;
  categoryId: string;
  status?: "draft" | "review" | "published";
  metaTitle?: string | null;
  metaDescription?: string | null;
};

export type SaveDraftResult =
  | { ok: true; id: string; slug: string; status: "draft" | "review" | "published" }
  | { ok: false; error: string };

async function ensureAuthorId(session: {
  userId: string;
  email: string | null;
  profile: { display_name: string | null };
}) {
  const admin = createAdminClient();
  const { data: rpcId, error: rpcError } = await admin.rpc("ensure_studio_author", {
    p_user_id: session.userId,
  });
  if (!rpcError && typeof rpcId === "string" && rpcId) {
    return rpcId;
  }

  const { data: byUser } = await admin.from("authors").select("id").eq("id", session.userId).maybeSingle();
  if (byUser?.id) return byUser.id;

  const name = session.profile.display_name?.trim() || session.email?.split("@")[0] || "Staff Writer";
  const slug = uniqueAuthorSlug(session.email ?? `${session.userId}@studio`, session.userId);

  const { data: bySlug } = await admin.from("authors").select("id").eq("slug", slug).maybeSingle();
  if (bySlug?.id) return bySlug.id;

  const { error } = await admin.from("authors").insert({
    id: session.userId,
    name,
    slug,
    title: "Staff Writer",
  });
  if (!error) return session.userId;

  const { data: created } = await admin.from("authors").select("id").eq("id", session.userId).maybeSingle();
  if (created?.id) return created.id;

  throw new Error(error.message || rpcError?.message || "Could not attach an author record.");
}

function canPublish(role: StudioRole, nextStatus: "draft" | "review" | "published") {
  if (nextStatus === "published") return canPublishArticle(role);
  return true;
}

function seoPayload(input: SaveDraftInput) {
  return {
    meta_title: emptyToNull(input.metaTitle),
    meta_description: emptyToNull(input.metaDescription),
  };
}

function missingSeoColumn(message: string | undefined) {
  const haystack = (message ?? "").toLowerCase();
  return haystack.includes("meta_title") || haystack.includes("meta_description");
}

export async function saveStudioDraft(input: SaveDraftInput): Promise<SaveDraftResult> {
  try {
    const session = await getStudioSession();
    if (!session) {
      return { ok: false, error: "Sign in again to save this draft." };
    }
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
        !isModerator(session.profile.role) &&
        existing.author_id !== session.userId &&
        existing.author_id !== authorId
      ) {
        return { ok: false, error: "You cannot edit this draft." };
      }

      const nextStatus = requested ?? existing.status;
      if (!canPublish(session.profile.role, nextStatus)) {
        return { ok: false, error: "Only a moderator can publish." };
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
        meta_title?: string | null;
        meta_description?: string | null;
      } = {
        title,
        body,
        excerpt,
        cover_image_url,
        cover_image_alt,
        category_id: input.categoryId,
        status: nextStatus,
        ...seoPayload(input),
      };

      if (nextStatus === "published") {
        update.published_at = new Date().toISOString();
      }

      const written = await admin.from("articles").update(update).eq("id", existing.id);
      if (written.error && missingSeoColumn(written.error.message)) {
        const withoutSeo = {
          title: update.title,
          body: update.body,
          excerpt: update.excerpt,
          cover_image_url: update.cover_image_url,
          cover_image_alt: update.cover_image_alt,
          category_id: update.category_id,
          status: update.status,
          ...(update.published_at ? { published_at: update.published_at } : {}),
        };
        const retry = await admin.from("articles").update(withoutSeo).eq("id", existing.id);
        if (retry.error) return { ok: false, error: retry.error.message };
      } else if (written.error) {
        return { ok: false, error: written.error.message };
      }

      if (nextStatus === "published") {
        revalidatePath("/", "layout");
        revalidatePath(`/news/${existing.slug}`);
      }

      return { ok: true, id: existing.id, slug: existing.slug, status: nextStatus };
    }

    const nextStatus = requested ?? "draft";
    if (!canPublish(session.profile.role, nextStatus)) {
      return { ok: false, error: "Only a moderator can publish." };
    }

    const slug = slugifyTitle(title);
    const insert = {
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
      ...seoPayload(input),
    };
    let { data, error } = await admin.from("articles").insert(insert).select("id, slug, status").single();

    if (error && missingSeoColumn(error.message)) {
      const withoutSeo = {
        slug: insert.slug,
        title: insert.title,
        excerpt: insert.excerpt,
        body: insert.body,
        cover_image_url: insert.cover_image_url,
        cover_image_alt: insert.cover_image_alt,
        category_id: insert.category_id,
        author_id: insert.author_id,
        status: insert.status,
        published_at: insert.published_at,
      };
      const retry = await admin.from("articles").insert(withoutSeo).select("id, slug, status").single();
      data = retry.data;
      error = retry.error;
    }

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

export type StudioInviteRole = "writer" | "moderator";

export type InviteStudioStaffInput = {
  name: string;
  email: string;
  role: StudioInviteRole;
};

export type InviteStudioStaffResult =
  | {
      ok: true;
      name: string;
      email: string;
      role: StudioInviteRole;
      password: string | null;
      inviteLink: string | null;
      existing: boolean;
    }
  | { ok: false; error: string };

function generateTemporaryPassword() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

function isInviteRole(role: string): role is StudioInviteRole {
  return role === "writer" || role === "moderator";
}

function emailAlreadyRegistered(message: string, code?: string) {
  const haystack = `${code ?? ""} ${message}`.toLowerCase();
  return (
    haystack.includes("already") ||
    haystack.includes("email_exists") ||
    haystack.includes("user_already_exists")
  );
}

async function studioLoginUrl() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) return undefined;
  const proto =
    requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}/studio/login`;
}

async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 8; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const match = data.users.find((user) => user.email?.toLowerCase() === target);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function createAuthUserForInvite(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  name: string,
  password: string,
  redirectTo: string | undefined,
) {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name, name },
  });

  if (created.data.user && !created.error) {
    return { user: created.data.user, existing: false as const, password };
  }

  if (created.error && !emailAlreadyRegistered(created.error.message, created.error.code)) {
    throw new Error(created.error.message);
  }

  const invited = await admin.auth.admin.inviteUserByEmail(email, {
    data: { display_name: name, name },
    redirectTo,
  });
  if (invited.data.user && !invited.error) {
    return { user: invited.data.user, existing: false as const, password: null };
  }

  const existing = await findAuthUserByEmail(admin, email);
  if (existing) return { user: existing, existing: true as const, password: null };

  throw new Error(
    created.error?.message || invited.error?.message || "Could not create this newsroom account.",
  );
}

async function inviteActionLink(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  existing: boolean,
  redirectTo: string | undefined,
) {
  const generated = await admin.auth.admin.generateLink({
    type: existing ? "recovery" : "magiclink",
    email,
    options: redirectTo ? { redirectTo } : undefined,
  });
  if (generated.error) return null;
  const properties = generated.data.properties;
  return properties?.action_link ?? null;
}

export async function inviteStudioStaff(
  input: InviteStudioStaffInput,
): Promise<InviteStudioStaffResult> {
  try {
    const session = await getStudioSession();
    if (!session || !canInviteStaff(session.profile.role)) {
      return { ok: false, error: "Only a moderator can invite staff." };
    }

    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    const role = input.role;

    if (!name) return { ok: false, error: "Enter a name for the masthead." };
    if (!email.includes("@")) return { ok: false, error: "Enter a valid email address." };
    if (!isInviteRole(role)) return { ok: false, error: "Choose Writer or Moderator." };

    const admin = createAdminClient();
    const redirectTo = await studioLoginUrl();
    const { user, existing, password } = await createAuthUserForInvite(
      admin,
      email,
      name,
      generateTemporaryPassword(),
      redirectTo,
    );

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: user.id,
        role,
        display_name: name,
      },
      { onConflict: "id" },
    );
    if (profileError) return { ok: false, error: profileError.message };

    await admin.rpc("ensure_studio_author", { p_user_id: user.id });

    let inviteLink: string | null = null;
    try {
      inviteLink = await inviteActionLink(admin, email, existing, redirectTo);
    } catch {
      inviteLink = null;
    }

    return {
      ok: true,
      name,
      email,
      role,
      password,
      inviteLink,
      existing,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not invite this person.";
    return { ok: false, error: message };
  }
}
