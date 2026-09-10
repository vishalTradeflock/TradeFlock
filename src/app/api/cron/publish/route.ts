import { NextResponse } from "next/server";
import { processNewsLead } from "@/lib/agents/pipeline";

const TEST_LEAD = {
  topic: "U.S. chip equipment makers report a jump in export licenses for allied fabs",
  category: "tech",
  rawSource:
    "Commerce officials said licenses for lithography tools and deposition gear bound for Japan, the Netherlands, and South Korea rose in the latest quarter. Two unnamed supplier executives said order books firmed after customers locked multi-year tool slots. No dollar total was disclosed. Rival Chinese toolmakers were not named in the briefing.",
};

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function runPipeline(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processNewsLead(TEST_LEAD);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return runPipeline(request);
}

export async function POST(request: Request) {
  return runPipeline(request);
}
