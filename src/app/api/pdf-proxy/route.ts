import { NextResponse } from "next/server";
import { isAllowedPdfHost } from "@/lib/pdf-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (target.protocol !== "https:" || !isAllowedPdfHost(target.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  const upstream = await fetch(target.toString(), {
    headers: { Accept: "application/pdf,*/*" },
    cache: "no-store",
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "PDF fetch failed" },
      { status: upstream.status || 502 },
    );
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "application/pdf",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
