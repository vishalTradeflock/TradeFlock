import { NextResponse } from "next/server";
import { runTriage } from "@/lib/newsroom/triage-run";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 120;

// Chief of Staff triage cron. Writes story_signals statuses and story_claims
// only; cannot create, draft or publish articles. ?dry=1 decides without writing.
function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

async function run(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dryRun = new URL(request.url).searchParams.get("dry") === "1";
  try {
    const result = await runTriage({ dryRun });
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, mode: "triage", published: 0, articlesCreated: 0, error: err instanceof Error ? err.message : "Triage failed" },
      { status: 500 },
    );
  }
}

export const GET = run;
export const POST = run;
