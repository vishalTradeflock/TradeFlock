import { NextResponse } from "next/server";
import { runSignalDesk } from "@/lib/newsroom/signal-desk";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 120;

// Signal Desk cron. Writes story_signals only; cannot create or publish articles.
function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

async function run(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runSignalDesk());
  } catch (err) {
    return NextResponse.json(
      { ok: false, mode: "signals", published: 0, error: err instanceof Error ? err.message : "Signal Desk failed" },
      { status: 500 },
    );
  }
}

export const GET = run;
export const POST = run;
