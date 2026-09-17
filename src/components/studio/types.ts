import { articlePath } from "@/lib/types";

export type StudioCategory = {
  id: string;
  name: string;
  slug: string;
};

export type StudioStoryStatus = "draft" | "review" | "published";

export type DeskStory = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  status: StudioStoryStatus;
  updatedAt: string;
  publishedAt: string;
  authorId: string;
  authorName: string;
  categoryName: string;
};

export function storyPreviewHref(story: { status: StudioStoryStatus; slug: string; id: string }) {
  if (story.status === "published") return articlePath(story.slug);
  return `/studio/write?id=${story.id}`;
}

