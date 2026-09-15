import { NextResponse } from "next/server";
import type { StudioCategory } from "@/components/studio/types";
import { getStudioSession } from "@/lib/studio/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";

export const runtime = "nodejs";

const DESK_SLUGS = ["tech", "markets", "leadership", "finance", "success-insights"];

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

  let initialDraft: {
    id: string;
    title: string;
    body: string;
    categoryId: string;
    status: "draft" | "review" | "published";
  } | null = null;

  if (id) {
    const admin = createAdminClient();
    const { data: article } = await admin
      .from("articles")
      .select("id, title, body, category_id, status, author_id")
      .eq("id", id)
      .maybeSingle();

    if (
      article &&
      (article.author_id === session.profile.author_id ||
        session.profile.role === "admin" ||
        session.profile.role === "editor")
    ) {
      initialDraft = {
        id: article.id,
        title: article.title,
        body: article.body,
        categoryId: article.category_id,
        status: article.status,
      };
    }
  }

  return NextResponse.json({
    role: session.profile.role,
    email: session.email,
    categories,
    initialDraft,
  });
}
