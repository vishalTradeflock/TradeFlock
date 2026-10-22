import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import {
  pathsForPublishedArticles,
  tagsForPublishedArticles,
  type PublishedArticleInvalidation,
} from "@/lib/revalidate-paths";

export type RevalidateMode = "action" | "handler";

function invalidateTag(tag: string, mode: RevalidateMode) {
  if (mode === "action") {
    updateTag(tag);
    return;
  }
  revalidateTag(tag, "max");
}

/**
 * Refresh the story, its desk, its author, the homepage, and the sitemap.
 * Does not revalidate the root layout, so other stories stay cached.
 * Server Actions expire tags immediately. Route handlers use stale-while-revalidate.
 */
export function revalidatePublishedArticles(
  articles: PublishedArticleInvalidation[],
  mode: RevalidateMode,
  extra?: { paths?: string[]; tags?: string[] },
) {
  if (!articles.length && !extra?.paths?.length && !extra?.tags?.length) return;
  for (const path of pathsForPublishedArticles(articles, extra?.paths)) {
    revalidatePath(path);
  }
  for (const tag of tagsForPublishedArticles(articles, extra?.tags)) {
    invalidateTag(tag, mode);
  }
}
