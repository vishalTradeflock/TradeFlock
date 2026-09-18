import { NextResponse } from "next/server";
import type { StudioAuthor, StudioCategory, StudioFaqDraft } from "@/components/studio/types";
import { parseArticleFaqs } from "@/lib/seo";
import { isModerator } from "@/lib/studio/roles";
import { getStudioSession } from "@/lib/studio/session";
import { studioAuthorIds } from "@/lib/studio/desk";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";

export const runtime = "nodejs";

const DESK_SLUGS = ["tech", "markets", "leadership", "finance", "success-insights"];

function asStudioAuthor(row: {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  title: string | null;
  avatar_url: string | null;
}): StudioAuthor {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    bio: row.bio ?? "",
    title: row.title ?? "",
    avatarUrl: row.avatar_url ?? "",
  };
}

export async function GET(request: Request) {
  const session = await getStudioSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug")
    .in("slug", DESK_SLUGS)
    .order("name");

  const categories: StudioCategory[] = (data ?? []).filter((row) =>
    DESK_SLUGS.includes(row.slug),
  );

  const admin = createAdminClient();
  const ownIds = await studioAuthorIds(session);
  const authorQuery = admin
    .from("authors")
    .select("id, name, slug, bio, title, avatar_url")
    .order("name");
  const authorRows = isModerator(session.profile.role)
    ? (await authorQuery).data
    : (await authorQuery.in("id", ownIds.length ? ownIds : ["00000000-0000-0000-0000-000000000000"])).data;
  const authors = (authorRows ?? []).map(asStudioAuthor);

  let initialDraft: {
    id: string;
    title: string;
    body: string;
    slug: string;
    categoryId: string;
    authorId: string;
    status: "draft" | "review" | "published";
    metaTitle: string;
    metaDescription: string;
    coverImageAlt: string;
    faqs: StudioFaqDraft[];
  } | null = null;

  if (id) {
    const withSeo = await admin
      .from("articles")
      .select(
        "id, title, body, slug, category_id, status, author_id, meta_title, meta_description, cover_image_alt, featured_image_alt, faqs",
      )
      .eq("id", id)
      .maybeSingle();

    const missingSeo =
      Boolean(withSeo.error?.message?.toLowerCase().includes("meta_title")) ||
      Boolean(withSeo.error?.message?.toLowerCase().includes("meta_description")) ||
      Boolean(withSeo.error?.message?.toLowerCase().includes("faqs")) ||
      Boolean(withSeo.error?.message?.toLowerCase().includes("featured_image_alt"));

    const article = missingSeo
      ? (
          await admin
            .from("articles")
            .select("id, title, body, slug, category_id, status, author_id, cover_image_alt")
            .eq("id", id)
            .maybeSingle()
        ).data
      : withSeo.data;

    if (article) {
      if (isModerator(session.profile.role) || ownIds.includes(article.author_id)) {
        const coverAlt =
          "featured_image_alt" in article && typeof article.featured_image_alt === "string"
            ? article.featured_image_alt
            : typeof article.cover_image_alt === "string"
              ? article.cover_image_alt
              : "";
        initialDraft = {
          id: article.id,
          title: article.title,
          body: article.body,
          slug: article.slug,
          categoryId: article.category_id,
          authorId: article.author_id,
          status: article.status,
          metaTitle: "meta_title" in article && typeof article.meta_title === "string" ? article.meta_title : "",
          metaDescription:
            "meta_description" in article && typeof article.meta_description === "string"
              ? article.meta_description
              : "",
          coverImageAlt: coverAlt,
          faqs: "faqs" in article ? parseArticleFaqs(article.faqs) : [],
        };
      }
    }
  }

  return NextResponse.json({
    role: session.profile.role,
    email: session.email,
    categories,
    authors,
    initialDraft,
  });
}
