import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
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
    .select("id, slug, status, author_id")
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
    revalidatePath("/", "layout");
    revalidatePath(`/news/${article.slug}`);
  }

  return NextResponse.json({ ok: true, id: article.id });
}
