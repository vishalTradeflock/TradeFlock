import { NextResponse } from "next/server";
import { syncMagazineFromLegacy } from "@/lib/sync-magazine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const slug = new URL(request.url).searchParams.get("slug")?.trim() ?? "";
  if (!slug) {
    return NextResponse.json({ ok: false, error: "Missing slug." }, { status: 400 });
  }

  try {
    const result = await syncMagazineFromLegacy(slug);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Magazine sync failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
