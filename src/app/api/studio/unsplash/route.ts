import { NextResponse } from "next/server";
import { loadUsedCoverKeys, searchUnsplash, UnsplashRateLimitError } from "@/lib/cover-picker";
import { isCoverKeyTaken } from "@/lib/cover-dedupe";
import { getStudioSession } from "@/lib/studio/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type UnsplashPhoto = {
  id: string;
  alt: string;
  url: string;
  thumb: string;
  photographer: string;
  photographerUrl: string;
};

/**
 * Studio image search. Photos already used as a cover on another story are
 * removed from the results (house rule: one image, one story). `exclude` is
 * the story being edited, so its own cover still shows.
 */
export async function GET(request: Request) {
  const session = await getStudioSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Unsplash is not configured. Add UNSPLASH_ACCESS_KEY." },
      { status: 501 },
    );
  }

  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() || "business";
  const page = Math.min(Math.max(Number(params.get("page")) || 1, 1), 20);
  const excludeId = params.get("exclude")?.trim() || null;

  try {
    const [results, used] = await Promise.all([
      searchUnsplash(query, page, key, 24),
      loadUsedCoverKeys(createAdminClient(), { excludeId }),
    ]);
    const photos: UnsplashPhoto[] = results
      .filter((photo) => !isCoverKeyTaken(photo.key, used))
      .map((photo) => ({
        id: photo.key,
        alt: photo.alt,
        url: photo.url,
        thumb: photo.thumb,
        photographer: photo.photographer,
        photographerUrl: photo.photographerUrl,
      }));
    return NextResponse.json({ photos, page });
  } catch (err) {
    if (err instanceof UnsplashRateLimitError) {
      return NextResponse.json({ error: "Unsplash rate limit reached. Try again later." }, { status: 429 });
    }
    return NextResponse.json({ error: "Unsplash search failed." }, { status: 502 });
  }
}
