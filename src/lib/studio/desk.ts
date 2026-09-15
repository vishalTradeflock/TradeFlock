import type { DeskStory, StudioStoryStatus } from "@/components/studio/types";
import { uniqueAuthorSlug } from "@/lib/studio/copy";
import { isModerator } from "@/lib/studio/roles";
import type { StudioSession } from "@/lib/studio/session";
import { createAdminClient } from "@/lib/supabase/admin";

type StoryRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  status: StudioStoryStatus;
  updated_at: string;
  published_at: string;
  author_id: string;
  category?: { name: string } | { name: string }[] | null;
  author?: { name: string } | { name: string }[] | null;
};

function oneName(value: { name: string } | { name: string }[] | null | undefined) {
  if (Array.isArray(value)) return value[0]?.name ?? "Desk";
  return value?.name ?? "Desk";
}

function mapStory(row: StoryRow): DeskStory {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    status: row.status,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    authorId: row.author_id,
    authorName: oneName(row.author),
    categoryName: oneName(row.category),
  };
}

const SELECT =
  "id, slug, title, excerpt, status, updated_at, published_at, author_id, category:categories(name), author:authors(name)";

export type DeskLists = {
  review: DeskStory[];
  published: DeskStory[];
  drafts: DeskStory[];
};

export async function studioAuthorIds(session: StudioSession) {
  const ids = new Set<string>([session.userId]);
  const admin = createAdminClient();
  const slug = uniqueAuthorSlug(session.email ?? `${session.userId}@studio`, session.userId);
  const { data } = await admin
    .from("authors")
    .select("id")
    .or(`id.eq.${session.userId},slug.eq.${slug}`);
  for (const row of data ?? []) ids.add(row.id);
  return [...ids];
}

export async function listDeskStories(session: StudioSession): Promise<DeskLists> {
  const admin = createAdminClient();
  const authorIds = isModerator(session.profile.role) ? null : await studioAuthorIds(session);

  const scoped = (status: StudioStoryStatus) => {
    let query = admin
      .from("articles")
      .select(SELECT)
      .eq("status", status)
      .order("updated_at", { ascending: false })
      .limit(80);
    if (authorIds) {
      query = query.in("author_id", authorIds);
    }
    return query;
  };

  const [review, published, drafts] = await Promise.all([
    scoped("review"),
    scoped("published"),
    scoped("draft"),
  ]);

  return {
    review: ((review.data ?? []) as unknown as StoryRow[]).map(mapStory),
    published: ((published.data ?? []) as unknown as StoryRow[]).map(mapStory),
    drafts: ((drafts.data ?? []) as unknown as StoryRow[]).map(mapStory),
  };
}
