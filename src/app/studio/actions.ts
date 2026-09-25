"use server";

import { revalidatePath } from "next/cache";
import {
  excerptFromHtml,
  uniqueAuthorSlug,
} from "@/lib/studio/copy";
import { headers } from "next/headers";
import {
  canAssignAnyAuthor,
  canInviteStaff,
  canManageSiteSettings,
  canPublishArticle,
  canWriteGlobalHeadCode,
} from "@/lib/studio/access";
import { prepareStudioFaqs, type StudioFaq } from "@/lib/studio/faqs";
import { BIO_MAX, sanitizeAltText, sanitizeBio, sanitizeVerificationToken } from "@/lib/studio/head-meta";
import { emptyToNull } from "@/lib/studio/seo";
import { allocateArticleSlug, isValidPublicSlug, sanitizeSlug } from "@/lib/studio/slug";
import { prepareGlobalHeadCode } from "@/lib/public-head";
import { isModerator, type StudioRole } from "@/lib/studio/roles";
import { getStudioSession } from "@/lib/studio/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { studioPublishFailures } from "@/lib/agents/studio-gate";
import { sanitizeArticleBody } from "@/lib/sanitize-article-body";
import { studioCoverFor } from "@/lib/studio/cover";
import { isCoverUniqueViolation } from "@/lib/cover-picker";

const COVER_TAKEN_MESSAGE =
  "That cover image was just used on another story. Save again to pick a different one.";

export type SaveDraftInput = {
  id?: string | null;
  title: string;
  body: string;
  categoryId: string;
  status?: "draft" | "review" | "published";
  metaTitle?: string | null;
  metaDescription?: string | null;
  slug?: string | null;
  authorId?: string | null;
  coverImageAlt?: string | null;
  faqs?: StudioFaq[];
};

export type SaveDraftResult =
  | { ok: true; id: string; slug: string; status: "draft" | "review" | "published" }
  | {
      ok: false;
      error: string;
      id?: string;
      slug?: string;
      status?: "draft" | "review" | "published";
    };

function houseStyleHoldMessage(failures: string[]) {
  return `Not published. Fix the house style before it can go live: ${failures.join("; ")}`;
}

async function blockedPublishMessage(
  admin: ReturnType<typeof createAdminClient>,
  input: { title: string; body: string; slug: string; categoryId: string; excludeSlug?: string },
) {
  const { data: category } = await admin.from("categories").select("slug").eq("id", input.categoryId).maybeSingle();
  const failures = await studioPublishFailures({
    title: input.title,
    slug: input.slug,
    html: input.body,
    categorySlug: category?.slug ?? "",
    excludeSlug: input.excludeSlug,
  });
  return failures.length ? houseStyleHoldMessage(failures) : null;
}

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

function uniqueSlugTakenMessage(message: string | undefined) {
  const haystack = (message ?? "").toLowerCase();
  return haystack.includes("duplicate") || haystack.includes("articles_slug") || haystack.includes("unique");
}

async function slugTakenByOther(
  admin: ReturnType<typeof createAdminClient>,
  slug: string,
  excludeId?: string,
) {
  const { data } = await admin.from("articles").select("id").eq("slug", slug).maybeSingle();
  if (!data?.id) return false;
  return data.id !== excludeId;
}

async function nextAvailableSlug(
  admin: ReturnType<typeof createAdminClient>,
  base: string,
  excludeId?: string,
) {
  return allocateArticleSlug(base, base, (slug) => slugTakenByOther(admin, slug, excludeId));
}

async function resolveAssignedAuthorId(
  admin: ReturnType<typeof createAdminClient>,
  session: { userId: string; email: string | null; profile: { display_name: string | null; role: StudioRole } },
  requested: string | null | undefined,
  existingAuthorId?: string,
) {
  const ownId = await ensureAuthorId(session);
  if (!canAssignAnyAuthor(session.profile.role)) {
    return { ok: true as const, authorId: ownId };
  }
  const target = requested?.trim() || existingAuthorId || ownId;
  const { data } = await admin.from("authors").select("id").eq("id", target).maybeSingle();
  if (!data?.id) return { ok: false as const, error: "Choose a valid author." };
  return { ok: true as const, authorId: data.id };
}

async function recordPublishedSlugRedirect(
  admin: ReturnType<typeof createAdminClient>,
  articleId: string,
  previousSlug: string,
  nextSlug: string,
) {
  if (previousSlug === nextSlug) return;
  await admin.from("article_slug_redirects").delete().eq("old_slug", nextSlug);
  const written = await admin.from("article_slug_redirects").upsert(
    { old_slug: previousSlug, article_id: articleId },
    { onConflict: "old_slug" },
  );
  if (written.error) {
    throw new Error(written.error.message || "Could not save the slug redirect.");
  }
}

function revalidateStoryPaths(slug: string, previousSlug?: string | null, authorSlug?: string | null) {
  revalidatePath("/", "layout");
  revalidatePath(`/${slug}`);
  if (previousSlug && previousSlug !== slug) revalidatePath(`/${previousSlug}`);
  if (authorSlug) revalidatePath(`/author/${authorSlug}`);
  revalidatePath("/sitemap.xml");
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
    const cover_image_alt = sanitizeAltText(input.coverImageAlt);
    const faqsResult = prepareStudioFaqs(input.faqs ?? []);
    if (!faqsResult.ok) return { ok: false, error: faqsResult.error };
    if (requested === "review" || requested === "published") {
      const incomplete = (input.faqs ?? []).some((entry) => {
        const question = String(entry?.question ?? "").trim();
        const answer = String(entry?.answer ?? "").trim();
        return Boolean(question) !== Boolean(answer);
      });
      if (incomplete) {
        return { ok: false, error: "Each FAQ needs both a question and an answer." };
      }
    }
    const faqs = faqsResult.faqs;

    const admin = createAdminClient();

    if (input.id) {
      const { data: existing, error: existingError } = await admin
        .from("articles")
        .select("id, slug, status, author_id, published_at, cover_image_url")
        .eq("id", input.id)
        .maybeSingle();

      if (existingError || !existing) return { ok: false, error: "Draft not found." };
      const assigned = await resolveAssignedAuthorId(admin, session, input.authorId, existing.author_id);
      if (!assigned.ok) return { ok: false, error: assigned.error };
      const authorId = assigned.authorId;
      if (
        !isModerator(session.profile.role) &&
        existing.author_id !== session.userId &&
        existing.author_id !== authorId
      ) {
        return { ok: false, error: "You cannot edit this draft." };
      }

      let nextStatus = requested ?? existing.status;
      if (!canPublish(session.profile.role, nextStatus)) {
        return { ok: false, error: "Only a moderator can publish." };
      }

      const rawSlug = (input.slug ?? "").trim();
      let nextSlug = existing.slug;
      const commitSlug = requested != null || existing.status !== "published";
      if (commitSlug) {
        const keepPublishedDirty = existing.status === "published" && rawSlug === existing.slug;
        if (!keepPublishedDirty && rawSlug) {
          const requestedSlug = sanitizeSlug(rawSlug);
          if (!isValidPublicSlug(requestedSlug)) {
            return { ok: false, error: "Use a lowercase URL-safe slug with letters, numbers, and hyphens." };
          }
          if (await slugTakenByOther(admin, requestedSlug, existing.id)) {
            return { ok: false, error: "That URL is already in use." };
          }
          nextSlug = requestedSlug;
        }
      }

      let publishBlocked: string | null = null;
      if (nextStatus === "published" && existing.status !== "published") {
        publishBlocked = await blockedPublishMessage(admin, {
          title,
          body,
          slug: nextSlug,
          categoryId: input.categoryId,
          excludeSlug: existing.slug,
        });
        if (publishBlocked) nextStatus = existing.status;
      }

      const cover_image_url = await studioCoverFor(admin, {
        articleId: existing.id,
        title,
        body,
        slug: nextSlug,
        categoryId: input.categoryId,
        currentCover: existing.cover_image_url,
        publishing: nextStatus === "published",
      });

      const update: Database["public"]["Tables"]["articles"]["Update"] = {
        title,
        body,
        excerpt,
        cover_image_url,
        cover_image_alt,
        featured_image: cover_image_url || null,
        featured_image_alt: cover_image_alt || null,
        category_id: input.categoryId,
        author_id: authorId,
        status: nextStatus,
        slug: nextSlug,
        faqs,
        ...seoPayload(input),
      };

      if (nextStatus === "published" && existing.status !== "published") {
        update.published_at = new Date().toISOString();
      }

      if (existing.status === "published" && nextSlug !== existing.slug) {
        await recordPublishedSlugRedirect(admin, existing.id, existing.slug, nextSlug);
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
          author_id: update.author_id,
          status: update.status,
          slug: update.slug,
          ...(typeof update.published_at === "string" ? { published_at: update.published_at } : {}),
        };
        const retry = await admin.from("articles").update(withoutSeo).eq("id", existing.id);
        if (retry.error) return { ok: false, error: retry.error.message };
      } else if (written.error) {
        if (isCoverUniqueViolation(written.error)) {
          return { ok: false, error: COVER_TAKEN_MESSAGE };
        }
        if (uniqueSlugTakenMessage(written.error.message)) {
          return { ok: false, error: "That URL is already in use." };
        }
        return { ok: false, error: written.error.message };
      }

      const { data: authorRow } = await admin.from("authors").select("slug").eq("id", authorId).maybeSingle();
      if (nextStatus === "published") {
        revalidateStoryPaths(nextSlug, existing.slug, authorRow?.slug);
      }

      if (publishBlocked) {
        return {
          ok: false,
          error: publishBlocked,
          id: existing.id,
          slug: nextSlug,
          status: nextStatus,
        };
      }

      return { ok: true, id: existing.id, slug: nextSlug, status: nextStatus };
    }

    let nextStatus = requested ?? "draft";
    if (!canPublish(session.profile.role, nextStatus)) {
      return { ok: false, error: "Only a moderator can publish." };
    }

    const assigned = await resolveAssignedAuthorId(admin, session, input.authorId);
    if (!assigned.ok) return { ok: false, error: assigned.error };
    const authorId = assigned.authorId;

    const requestedSlug = sanitizeSlug(input.slug ?? "");
    if ((input.slug ?? "").trim() && !isValidPublicSlug(requestedSlug)) {
      return { ok: false, error: "Use a lowercase URL-safe slug with letters, numbers, and hyphens." };
    }
    if (requestedSlug && (await slugTakenByOther(admin, requestedSlug))) {
      return { ok: false, error: "That URL is already in use." };
    }
    const slug = requestedSlug
      ? requestedSlug
      : await nextAvailableSlug(admin, title);

    let publishBlocked: string | null = null;
    if (nextStatus === "published") {
      publishBlocked = await blockedPublishMessage(admin, {
        title,
        body,
        slug,
        categoryId: input.categoryId,
      });
      if (publishBlocked) nextStatus = "draft";
    }

    const cover_image_url = await studioCoverFor(admin, {
      title,
      body,
      slug,
      categoryId: input.categoryId,
      publishing: nextStatus === "published",
    });

    const insert = {
      slug,
      title,
      excerpt,
      body,
      cover_image_url,
      cover_image_alt,
      featured_image: cover_image_url || null,
      featured_image_alt: cover_image_alt || null,
      category_id: input.categoryId,
      author_id: authorId,
      status: nextStatus,
      faqs,
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

    if (error || !data) {
      if (isCoverUniqueViolation(error)) {
        return { ok: false, error: COVER_TAKEN_MESSAGE };
      }
      if (uniqueSlugTakenMessage(error?.message)) {
        return { ok: false, error: "That URL is already in use." };
      }
      return { ok: false, error: error?.message ?? "Could not save draft." };
    }

    const { data: authorRow } = await admin.from("authors").select("slug").eq("id", authorId).maybeSingle();
    if (nextStatus === "published") {
      revalidateStoryPaths(data.slug, null, authorRow?.slug);
    }

    if (publishBlocked) {
      return {
        ok: false,
        error: publishBlocked,
        id: data.id,
        slug: data.slug,
        status: data.status,
      };
    }

    return { ok: true, id: data.id, slug: data.slug, status: data.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save draft.";
    return { ok: false, error: message };
  }
}

export type SaveAuthorInput = {
  id?: string | null;
  name: string;
  bio?: string | null;
  title?: string | null;
  avatarUrl?: string | null;
  slug?: string | null;
};

export type SaveAuthorResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: string };

export async function saveStudioAuthor(input: SaveAuthorInput): Promise<SaveAuthorResult> {
  try {
    const session = await getStudioSession();
    if (!session) return { ok: false, error: "Sign in again to save this byline." };

    const admin = createAdminClient();
    const ownId = await ensureAuthorId(session);
    const targetId = input.id?.trim() || ownId;
    if (!isModerator(session.profile.role) && targetId !== ownId) {
      return { ok: false, error: "You can only edit your own byline." };
    }

    const { data: existing } = await admin
      .from("authors")
      .select("id, slug")
      .eq("id", targetId)
      .maybeSingle();
    if (!existing) return { ok: false, error: "Author not found." };

    const name = input.name.trim();
    if (!name) return { ok: false, error: "Enter the author’s name." };
    const bio = sanitizeBio(input.bio);
    if ((input.bio ?? "").trim().length > BIO_MAX) {
      return { ok: false, error: `Keep the bio under ${BIO_MAX} characters.` };
    }
    const title = sanitizeBio(input.title).slice(0, 120) || null;
    const avatar = input.avatarUrl?.trim() || null;
    if (avatar && !/^https?:\/\//i.test(avatar) && !avatar.startsWith("/")) {
      return { ok: false, error: "Use a valid image URL for the profile photo." };
    }

    const requestedSlug = sanitizeSlug(input.slug ?? "");
    let slug = existing.slug;
    if (requestedSlug && requestedSlug !== existing.slug) {
      if (!isValidPublicSlug(requestedSlug)) {
        return { ok: false, error: "Use a lowercase URL-safe author slug." };
      }
      const { data: taken } = await admin.from("authors").select("id").eq("slug", requestedSlug).maybeSingle();
      if (taken && taken.id !== existing.id) {
        return { ok: false, error: "That author URL is already in use." };
      }
      slug = requestedSlug;
    }

    const written = await admin
      .from("authors")
      .update({
        name,
        bio: bio || null,
        title,
        avatar_url: avatar,
        slug,
      })
      .eq("id", existing.id);
    if (written.error) return { ok: false, error: written.error.message };

    revalidatePath(`/author/${slug}`);
    if (existing.slug !== slug) revalidatePath(`/author/${existing.slug}`);
    revalidatePath("/sitemap.xml");
    return { ok: true, id: existing.id, slug };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save this byline.";
    return { ok: false, error: message };
  }
}

export type SaveSiteVerificationInput = {
  google?: string | null;
  bing?: string | null;
};

export type SaveSiteVerificationResult = { ok: true } | { ok: false; error: string };

export async function saveSiteVerification(
  input: SaveSiteVerificationInput,
): Promise<SaveSiteVerificationResult> {
  try {
    const session = await getStudioSession();
    if (!session || !canManageSiteSettings(session.profile.role)) {
      return { ok: false, error: "Only a masthead editor can change site verification." };
    }

    const googleRaw = input.google?.trim() ?? "";
    const bingRaw = input.bing?.trim() ?? "";
    const google = googleRaw ? sanitizeVerificationToken(googleRaw) : null;
    const bing = bingRaw ? sanitizeVerificationToken(bingRaw) : null;
    if (googleRaw && !google) {
      return { ok: false, error: "Paste the Google verification token only — not a script or HTML page." };
    }
    if (bingRaw && !bing) {
      return { ok: false, error: "Paste the Bing verification token only — not a script or HTML page." };
    }

    const admin = createAdminClient();
    const written = await admin.from("site_settings").upsert(
      {
        id: "default",
        google_site_verification: google,
        bing_site_verification: bing,
      },
      { onConflict: "id" },
    );
    if (written.error) return { ok: false, error: written.error.message };

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save site settings.";
    return { ok: false, error: message };
  }
}

export type SaveGlobalHeadCodeResult = { ok: true } | { ok: false; error: string };

/**
 * Persists site_settings.global_head_code.
 * Site-wide executable HTML — masthead/admin only; no public write path.
 */
export async function saveGlobalHeadCode(input: {
  code?: string | null;
}): Promise<SaveGlobalHeadCodeResult> {
  try {
    const session = await getStudioSession();
    if (!session || !canWriteGlobalHeadCode(session.profile.role)) {
      return { ok: false, error: "Only a masthead editor can change global head code." };
    }

    const prepared = prepareGlobalHeadCode(input.code ?? "");
    if (!prepared.ok) return prepared;

    const admin = createAdminClient();
    const written = await admin.from("site_settings").upsert(
      {
        id: "default",
        global_head_code: prepared.value,
      },
      { onConflict: "id" },
    );
    if (written.error) return { ok: false, error: written.error.message };

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save global head code.";
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
