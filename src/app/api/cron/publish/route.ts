import { NextResponse } from "next/server";
import {
  collectFreshLeads,
  leadBatchSize,
  markLeadProcessed,
  type IncomingLead,
} from "@/lib/agents/leads";
import { processNewsLead, type PipelineResult } from "@/lib/agents/pipeline";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 120;

const TEST_LEAD: IncomingLead = {
  topic: "U.S. chip equipment makers report a jump in export licenses for allied fabs",
  category: "tech",
  rawSource:
    "Source: Local test fixture\nURL: https://example.com/test-lead\n\nHeadline: U.S. chip equipment makers report a jump in export licenses for allied fabs\n\nSummary:\nCommerce officials said licenses for lithography tools and deposition gear bound for Japan, the Netherlands, and South Korea rose in the latest quarter. Two unnamed supplier executives said order books firmed after customers locked multi-year tool slots. No dollar total was disclosed. Rival Chinese toolmakers were not named in the briefing.",
  sourceName: "Local test fixture",
  sourceUrl: "https://example.com/test-lead",
  titleKey: "u s chip equipment makers report a jump in export licenses for allied fabs",
};

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

function shouldUseTestLead() {
  return process.env.USE_TEST_LEAD === "1";
}

function errorResponse(err: unknown) {
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
    const result = await runLead(TEST_LEAD);
    return NextResponse.json({
      ok: true,
      mode: "test_lead",
      results: [result],
    });
  }

  const intake = await collectFreshLeads(leadBatchSize());
  if (intake.leads.length === 0) {
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

  for (const lead of intake.leads) {
    try {
      results.push(await runLead(lead));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Pipeline failed";
      failures.push({ topic: lead.topic, error: message });
    }
  }

  if (results.length === 0 && failures.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        mode: "rss",
        error: failures[0]?.error ?? "Pipeline failed",
        intake: {
          feedsAttempted: intake.feedsAttempted,
          feedErrors: intake.feedErrors,
          feedWarning: intake.feedWarning,
          candidates: intake.candidates,
          skipped: intake.skipped,
        },
        failures,
        results,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    mode: "rss",
    intake: {
      feedsAttempted: intake.feedsAttempted,
      feedErrors: intake.feedErrors,
      feedWarning: intake.feedWarning,
      candidates: intake.candidates,
      skipped: intake.skipped,
    },
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
