import { NextResponse } from "next/server";
import {
  collectFreshLeads,
  leadBatchSize,
  leadWasRecentlySeen,
  markLeadProcessed,
  type IncomingLead,
} from "@/lib/agents/leads";
import { processNewsLead, type PipelineResult } from "@/lib/agents/pipeline";
import { isLlmQuotaError } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// Default batch is 2 long-form drafts (writer + editor). 300s covers that and the max of 3.
export const maxDuration = 300;

const TEST_LEAD: IncomingLead = {
  topic: "Treasury 10-year auction stop-out forces dealers to widen concessions",
  category: "markets",
  rawSource:
    "Source: Local test fixture\nURL: https://example.com/test-lead-10y-auction\n\nHeadline: Treasury 10-year auction stop-out forces dealers to widen concessions\n\nSummary:\nThe U.S. Treasury sold a 10-year note at a stop-out yield that dealers said required wider concessions than the when-issued mid. Two primary dealers, speaking on the condition they not be named, said real-money bids were thinner after the latest Beige Book described a pullback in factory overtime. No allotment totals beyond the standard auction size were disclosed. The 10-year yield moved after the stop-out, according to the same desks.",
  sourceName: "Local test fixture",
  sourceUrl: "https://example.com/test-lead-10y-auction",
  titleKey: "treasury 10 year auction stop out forces dealers to widen concessions",
};

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

function shouldUseTestLead() {
  // The fixture is for local/preview only. Production always reads RSS so a
  // leftover USE_TEST_LEAD=1 cannot reprint the chip-export stub every tick.
  if (process.env.VERCEL_ENV === "production") return false;
  return process.env.USE_TEST_LEAD === "1";
}

function errorResponse(err: unknown) {
  if (isLlmQuotaError(err)) {
    return NextResponse.json({
      ok: true,
      reason: "llm_quota_exhausted",
      error: err.message,
      results: [],
    });
  }
  const message = err instanceof Error ? err.message : "Pipeline failed";
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}

function summarizeResult(lead: IncomingLead, result: PipelineResult) {
  return {
    topic: lead.topic,
    sourceName: lead.sourceName,
    sourceUrl: lead.sourceUrl,
    category: lead.category,
    ...result,
  };
}

function failureMessage(err: unknown): string {
  if (isLlmQuotaError(err)) return err.message;
  return err instanceof Error ? err.message : "Pipeline failed";
}

function isQuotaFailure(message: string): boolean {
  return /quota exhausted|RESOURCE_EXHAUSTED|(?:^|\D)429(?:\D|$)|exceeded your current quota/i.test(
    message,
  );
}

async function runLead(lead: IncomingLead) {
  const result = await processNewsLead(lead);
  await markLeadProcessed(lead, result.published ? "published" : "held");
  return summarizeResult(lead, result);
}

async function runPipeline(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (shouldUseTestLead()) {
    if (await leadWasRecentlySeen(TEST_LEAD)) {
      return NextResponse.json({
        ok: true,
        mode: "test_lead",
        reason: "already_processed",
        results: [],
      });
    }

    const result = await runLead(TEST_LEAD);
    return NextResponse.json({
      ok: true,
      mode: "test_lead",
      results: [result],
    });
  }

  const intake = await collectFreshLeads(leadBatchSize());
  if (intake.leads.length === 0) {
    if (process.env.VERCEL_ENV !== "production" && !(await leadWasRecentlySeen(TEST_LEAD))) {
      const result = await runLead(TEST_LEAD);
      return NextResponse.json({
        ok: true,
        mode: "rss",
        reason: "no_fresh_leads_local_fixture",
        intake: {
          feedsAttempted: intake.feedsAttempted,
          feedErrors: intake.feedErrors,
          feedWarning: intake.feedWarning,
          candidates: intake.candidates,
          skipped: intake.skipped,
        },
        results: [result],
      });
    }

    return NextResponse.json({
      ok: true,
      mode: "rss",
      reason: "no_fresh_leads",
      intake: {
        feedsAttempted: intake.feedsAttempted,
        feedErrors: intake.feedErrors,
        feedWarning: intake.feedWarning,
        candidates: intake.candidates,
        skipped: intake.skipped,
      },
      results: [],
    });
  }

  const results: ReturnType<typeof summarizeResult>[] = [];
  const failures: { topic: string; error: string }[] = [];
  let quotaExhausted = false;

  for (const lead of intake.leads) {
    try {
      results.push(await runLead(lead));
    } catch (err) {
      const message = failureMessage(err);
      failures.push({ topic: lead.topic, error: message });
      if (isLlmQuotaError(err) || isQuotaFailure(message)) {
        quotaExhausted = true;
        break;
      }
    }
  }

  const intakeSummary = {
    feedsAttempted: intake.feedsAttempted,
    feedErrors: intake.feedErrors,
    feedWarning: intake.feedWarning,
    candidates: intake.candidates,
    skipped: intake.skipped,
  };

  if (results.length === 0 && failures.length > 0) {
    if (quotaExhausted || failures.every((item) => isQuotaFailure(item.error))) {
      return NextResponse.json({
        ok: true,
        mode: "rss",
        reason: "llm_quota_exhausted",
        error: failures[0]?.error ?? "Gemini quota exhausted.",
        intake: intakeSummary,
        failures,
        results,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        mode: "rss",
        error: failures[0]?.error ?? "Pipeline failed",
        intake: intakeSummary,
        failures,
        results,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    mode: "rss",
    ...(quotaExhausted ? { reason: "llm_quota_exhausted" } : {}),
    intake: intakeSummary,
    failures,
    results,
  });
}

export async function GET(request: Request) {
  try {
    return await runPipeline(request);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    return await runPipeline(request);
  } catch (err) {
    return errorResponse(err);
  }
}
