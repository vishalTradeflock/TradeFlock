import { NextResponse } from "next/server";
import { getStudioSession } from "@/lib/studio/session";

export const runtime = "nodejs";

type UnsplashPhoto = {
  id: string;
  alt: string;
  url: string;
  photographer: string;
  photographerUrl: string;
};

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

  const query = new URL(request.url).searchParams.get("q")?.trim() || "business";
  const response = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12&orientation=landscape`,
    {
      headers: {
        Authorization: `Client-ID ${key}`,
        "Accept-Version": "v1",
      },
      next: { revalidate: 60 },
    },
  );

  if (!response.ok) {
    return NextResponse.json({ error: "Unsplash search failed." }, { status: 502 });
  }

  const payload = (await response.json()) as {
    results?: Array<{
      id: string;
      alt_description: string | null;
      urls: { regular: string };
      user: { name: string; links: { html: string } };
    }>;
  };

  const photos: UnsplashPhoto[] = (payload.results ?? []).map((photo) => ({
    id: photo.id,
    alt: photo.alt_description ?? `Photo by ${photo.user.name}`,
    url: photo.urls.regular,
    photographer: photo.user.name,
    photographerUrl: photo.user.links.html,
  }));

  return NextResponse.json({ photos });
}
