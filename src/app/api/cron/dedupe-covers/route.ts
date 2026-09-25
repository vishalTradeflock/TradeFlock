import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { runCoverBackfill } from "@/lib/cover-backfill";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Cover backfill, run where the service-role env already lives (Vercel).
 * Dry run unless `?apply=1`. Processes up to `limit` stories per call; call
 * again until `toChange` reaches 0. Triggered by .github/workflows/dedupe-covers.yml.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const apply = params.get("apply") === "1" || params.get("apply") === "true";
  const limit = Math.min(Math.max(Number(params.get("limit")) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  try {
    const report = await runCoverBackfill(createAdminClient(), {
      apply,
      limit,
      unsplashAccessKey: process.env.UNSPLASH_ACCESS_KEY ?? null,
    });
    if (report.applied > 0) {
      revalidatePath("/", "layout");
      for (const change of report.changes) {
        if (change.applied && change.slug) revalidatePath(`/${change.slug}`);
      }
    }
    const { changes, ...summary } = report;
    return NextResponse.json({
      ...summary,
      remaining: Math.max(0, report.toChange - report.applied),
      changes: changes.map((change) => ({
        slug: change.slug,
        reason: change.reason,
        oldKey: change.oldKey,
        newCover: change.newCover,
        query: change.query,
        applied: change.applied,
        error: change.error,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backfill failed" },
      { status: 500 },
    );
  }
}
