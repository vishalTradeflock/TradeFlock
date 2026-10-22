import { NextResponse } from "next/server";
import { revalidatePublishedArticles } from "@/lib/revalidate-public";
import { canDeleteArticle } from "@/lib/studio/access";
import { getStudioSession } from "@/lib/studio/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getStudioSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!canDeleteArticle(session.profile.role)) {
    return NextResponse.json({ error: "Only a moderator can delete stories." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing story id." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: article, error: loadError } = await admin
    .from("articles")
    .select("id, slug, status, author_id, category_id")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !article) {
    return NextResponse.json({ error: "Story not found." }, { status: 404 });
  }

  const { error } = await admin.from("articles").delete().eq("id", article.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (article.status === "published") {
    const [category, author] = await Promise.all([
      article.category_id
        ? admin.from("categories").select("slug").eq("id", article.category_id).maybeSingle()
        : Promise.resolve({ data: null }),
      article.author_id
        ? admin.from("authors").select("slug").eq("id", article.author_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    revalidatePublishedArticles(
      [
        {
          slug: article.slug,
          categorySlug: category.data?.slug,
          authorSlug: author.data?.slug,
          authorId: article.author_id,
        },
      ],
      "handler",
    );
  }

  return NextResponse.json({ ok: true, id: article.id });
}
