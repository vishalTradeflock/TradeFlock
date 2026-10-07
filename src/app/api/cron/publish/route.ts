import { NextResponse } from "next/server";
import {
  collectFreshLeads,
  leadBatchSize,
  leadSourcePoolSize,
  leadWasRecentlySeen,
  markLeadProcessed,
  type IncomingLead,
} from "@/lib/agents/leads";
import {
  selectWritableLeads,
  SOURCE_ARTICLE_TIMEOUT_MS,
  type SourceSelection,
} from "@/lib/agents/source-article";
import { processNewsLead, type PipelineResult } from "@/lib/agents/pipeline";
import { runSignalDesk, wireMode } from "@/lib/newsroom/signal-desk";
import {
  isLlmQuotaError,
  isLlmUnavailableError,
  llmTimeRemainingMs,
  runWithLlmDeadline,
} from "@/lib/llm";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// Default batch is 3 long-form drafts (writer + editor). Cap is 4. A lead is
// deferred when less than 60s remains, so the 300s maxDuration still holds.
export const maxDuration = 300;

// Gemini calls (including retry backoff) must finish inside this budget, which
// leaves headroom under maxDuration for Supabase writes and the response.
const LLM_BUDGET_MS = (maxDuration - 30) * 1000;
// Don't start a new lead (writer + editor) with less than this left; it stays
// unprocessed and is picked up by the next 15-minute run.
const MIN_LEAD_BUDGET_MS = 60_000;

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
  if (isLlmUnavailableError(err)) {
    return NextResponse.json({
      ok: true,
      reason: "llm_unavailable",
      error: err.message,
      results: [],
    });
  }
  const message = err instanceof Error ? err.message : "Pipeline failed";
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}

function publicResult(result: PipelineResult): PipelineResult {
  if (result.published) return result;
  const { verdict: _verdict, ...rest } = result;
  void _verdict;
  return rest;
}

function summarizeResult(lead: IncomingLead, result: PipelineResult) {
  return {
    topic: lead.topic,
    sourceName: lead.sourceName,
    sourceUrl: lead.sourceUrl,
    category: lead.category,
    ...publicResult(result),
  };
}

type LeadOutcome = {
  lead: IncomingLead;
  result: PipelineResult;
};

async function runLead(lead: IncomingLead): Promise<LeadOutcome> {
  const result = await processNewsLead(lead);
  await markLeadProcessed(lead, result.published ? "published" : "held");
  return { lead, result };
}

function sourceReport(
  stats: SourceSelection<IncomingLead>["stats"],
  outcomes: LeadOutcome[],
) {
  const written = outcomes.length;
  const published = outcomes.filter((outcome) => outcome.result.published).length;
  return {
    fetched: stats.fetched,
    "skipped-thin": stats.skippedThin,
    "skipped-blocked": stats.skippedBlocked,
    "skipped-non-english": stats.skippedNonEnglish,
    written,
    published,
    held: written - published,
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

async function runPipeline(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Phase 0: the wire is the Signal Desk. Default (and production) mode writes
  // signal cards only: no writer, no editor, no article rows, no publish.
  const mode = wireMode();
  if (mode === "signals") {
    return NextResponse.json(await runSignalDesk());
  }
  // WIRE_MODE=publish is the legacy writer path kept for transition only. It
  // can no longer publish: approved copy is saved as a draft (see
  // commitVerdict in pipeline.ts) and the DB editorial gate refuses any
  // publish without a Wire Editor verdict. There is no force path.
  const force = false;

  if (shouldUseTestLead()) {
    if (await leadWasRecentlySeen(TEST_LEAD)) {
      return NextResponse.json({
        ok: true,
        mode: "test_lead",
        reason: "already_processed",
        force,
        results: [],
      });
    }

    const outcome = await runLead(TEST_LEAD);

    return NextResponse.json({
      ok: true,
      mode: "test_lead",
      force,
      results: [summarizeResult(outcome.lead, outcome.result)],
    });
  }

  const intake = await collectFreshLeads(leadSourcePoolSize());
  if (intake.leads.length === 0) {
    if (process.env.VERCEL_ENV !== "production" && !(await leadWasRecentlySeen(TEST_LEAD))) {
      const outcome = await runLead(TEST_LEAD);
      return NextResponse.json({
        ok: true,
        mode: "rss",
        reason: "no_fresh_leads_local_fixture",
        force,
        intake: {
          feedsAttempted: intake.feedsAttempted,
          feedErrors: intake.feedErrors,
          feedWarning: intake.feedWarning,
          candidates: intake.candidates,
          skipped: intake.skipped,
        },
        results: [summarizeResult(outcome.lead, outcome.result)],
      });
    }

    return NextResponse.json({
      ok: true,
      mode: "rss",
      reason: "no_fresh_leads",
      force,
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

  const intakeSummary = {
    feedsAttempted: intake.feedsAttempted,
    feedErrors: intake.feedErrors,
    feedWarning: intake.feedWarning,
    candidates: intake.candidates,
    skipped: intake.skipped,
  };

  const selected = await selectWritableLeads(intake.leads, {
    limit: leadBatchSize(),
    timeRemainingMs: llmTimeRemainingMs,
    minBudgetMs: MIN_LEAD_BUDGET_MS + SOURCE_ARTICLE_TIMEOUT_MS,
  });
  for (const skip of selected.skipped) {
    const bucket =
      skip.reason === "thin" ? "thin" : skip.reason === "non_english" ? "non_english" : "blocked";
    console.warn(`[publish] skip ${bucket} "${skip.lead.topic}": ${skip.detail}`);
    if (skip.persist) await markLeadProcessed(skip.lead, "held");
  }
  if (selected.stopped === "time" && selected.deferred.length > 0) {
    console.warn(
      `[publish] source fetch deferred ${selected.deferred.length} lead(s); time budget`,
    );
  }
  const skips = selected.skipped.map((skip) => ({
    topic: skip.lead.topic,
    reason: skip.reason,
    detail: skip.detail,
  }));

  if (selected.leads.length === 0) {
    const source = sourceReport(selected.stats, []);
    console.log(
      `[publish] source fetched=${source.fetched} skipped-thin=${source["skipped-thin"]} skipped-blocked=${source["skipped-blocked"]} skipped-non-english=${source["skipped-non-english"]} written=0 published=0 held=0`,
    );
    return NextResponse.json({
      ok: true,
      mode: "rss",
      reason: "no_writable_leads",
      force,
      intake: intakeSummary,
      source,
      skips,
      ...(selected.stopped === "time" && selected.deferred.length
        ? { deferred: selected.deferred.map((lead) => lead.topic) }
        : {}),
      results: [],
    });
  }

  const outcomes: LeadOutcome[] = [];
  const failures: { topic: string; error: string }[] = [];
  const deferred: string[] = [];
  let quotaExhausted = false;
  let unavailableFailures = 0;

  for (const lead of selected.leads) {
    if (llmTimeRemainingMs() < MIN_LEAD_BUDGET_MS) {
      deferred.push(lead.topic);
      continue;
    }
    try {
      outcomes.push(await runLead(lead));
    } catch (err) {
      const message = failureMessage(err);
      failures.push({ topic: lead.topic, error: message });
      if (isLlmUnavailableError(err)) {
        // Gemini stayed busy for this story after retries: skip it (it is not
        // marked processed, so the next run retries it) and try the next lead.
        unavailableFailures += 1;
        console.warn(`[publish] skipped "${lead.topic}": ${message}`);
        continue;
      }
      if (isLlmQuotaError(err) || isQuotaFailure(message)) {
        quotaExhausted = true;
        break;
      }
    }
  }
  if (deferred.length > 0) {
    console.warn(`[publish] time budget low; deferred ${deferred.length} lead(s) to the next run`);
  }


  const results = outcomes.map((outcome) => summarizeResult(outcome.lead, outcome.result));
  const source = sourceReport(selected.stats, outcomes);
  console.log(
    `[publish] source fetched=${source.fetched} skipped-thin=${source["skipped-thin"]} skipped-blocked=${source["skipped-blocked"]} skipped-non-english=${source["skipped-non-english"]} written=${source.written} published=${source.published} held=${source.held}`,
  );

  if (results.length === 0 && failures.length > 0) {
    if (quotaExhausted || failures.every((item) => isQuotaFailure(item.error))) {
      return NextResponse.json({
        ok: true,
        mode: "rss",
        reason: "llm_quota_exhausted",
        error: failures[0]?.error ?? "Gemini quota exhausted.",
        force,
        intake: intakeSummary,
        source,
        skips,
        failures,
        results,
      });
    }

    if (unavailableFailures === failures.length) {
      // Every attempted story hit Gemini "busy" after retries. Like quota, this
      // is an upstream outage, not a pipeline bug: report it without a 500.
      return NextResponse.json({
        ok: true,
        mode: "rss",
        reason: "llm_unavailable",
        error: failures[0]?.error ?? "Gemini unavailable.",
        force,
        intake: intakeSummary,
        source,
        skips,
        failures,
        ...(deferred.length ? { deferred } : {}),
        results,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        mode: "rss",
        error: failures[0]?.error ?? "Pipeline failed",
        force,
        intake: intakeSummary,
        source,
        skips,
        failures,
        results,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    mode: "rss",
    force,
    ...(quotaExhausted ? { reason: "llm_quota_exhausted" } : {}),
    intake: intakeSummary,
    source,
    skips,
    failures,
    ...(deferred.length ? { deferred } : {}),
    results,
  });
}

export async function GET(request: Request) {
  try {
    return await runWithLlmDeadline(Date.now() + LLM_BUDGET_MS, () => runPipeline(request));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    return await runWithLlmDeadline(Date.now() + LLM_BUDGET_MS, () => runPipeline(request));
  } catch (err) {
    return errorResponse(err);
  }
}
