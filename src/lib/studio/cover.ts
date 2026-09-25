import { loadUsedCoverKeys, pickUniqueCover } from "@/lib/cover-picker";
import { resolveCoverImage } from "@/lib/images";
import { coverFromHtml } from "@/lib/studio/copy";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Cover for a Studio save.
 * - Drafts/review: the first image in the body (or "" for the neutral card).
 * - Publishing / published: the body image or the story's current cover if no
 *   other story uses it; otherwise the next unused Unsplash photo found with
 *   story-specific search terms; otherwise "" (neutral card). Never a shared
 *   stock photo.
 */
export async function studioCoverFor(
  admin: Admin,
  input: {
    articleId?: string | null;
    title: string;
    body: string;
    categoryId: string;
    currentCover?: string | null;
    publishing: boolean;
  },
): Promise<string> {
  const bodyCover = resolveCoverImage(coverFromHtml(input.body));
  if (!input.publishing) return bodyCover ?? "";

  const [used, category] = await Promise.all([
    loadUsedCoverKeys(admin, { excludeId: input.articleId }),
    admin.from("categories").select("slug").eq("id", input.categoryId).maybeSingle(),
  ]);
  const preferred = [bodyCover, resolveCoverImage(input.currentCover)];
  try {
    const picked = await pickUniqueCover({
      title: input.title,
      categorySlug: category.data?.slug ?? null,
      preferred,
      used,
      accessKey: process.env.UNSPLASH_ACCESS_KEY ?? null,
    });
    return picked?.url ?? "";
  } catch {
    // Unsplash down / rate-limited (preferred images were already tried and taken):
    // publish with the neutral card rather than reuse another story's image.
    return "";
  }
}
