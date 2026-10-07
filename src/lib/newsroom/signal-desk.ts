import { collectFreshLeads, markLeadProcessed, normalizeUrl, type IncomingLead } from "@/lib/agents/leads";
import { resolveWriterDesk } from "@/lib/agents/prompts";
import { parseLeadNotes } from "@/lib/agents/wire-hygiene";
import { newsroomDb } from "@/lib/newsroom/db";
import { buildSignal, clusterSignals, type SignalDesk } from "@/lib/newsroom/signals";

export { wireMode, type WireMode } from "@/lib/newsroom/wire-mode";

const SIGNAL_POOL = 40;
const CLUSTER_WINDOW_MS = 72 * 60 * 60 * 1000;

function summaryOf(lead: IncomingLead): string {
  const idx = lead.rawSource.indexOf("Summary:");
  return (idx >= 0 ? lead.rawSource.slice(idx + 8) : lead.rawSource).replace(/\s+/g, " ").trim();
}

/**
 * Signal Desk run: ingest -> filter (freshness, language, PR, via
 * collectFreshLeads) -> dedupe -> entities -> score -> cluster -> story_signals.
 * Never calls the writer/editor, never creates article rows, never publishes.
 */
export async function runSignalDesk() {
  const intake = await collectFreshLeads(SIGNAL_POOL);
  const drafts = intake.leads.map((lead) => {
    const notes = parseLeadNotes(lead.rawSource);
    const publishedAtMs = notes.publishedAt ? Date.parse(notes.publishedAt) : 0;
    const signal = buildSignal(
      {
        title: lead.topic,
        summary: summaryOf(lead),
        sourceName: lead.sourceName,
        sourceUrl: lead.sourceUrl,
        publishedAtMs: Number.isFinite(publishedAtMs) ? publishedAtMs : 0,
        desk: resolveWriterDesk(lead.category) as SignalDesk,
      },
      lead.titleKey,
    );
    return { lead, publishedAtMs, ...signal };
  });

  const { kept, duplicates } = clusterSignals(drafts);
  const db = newsroomDb();
  const since = new Date(Date.now() - CLUSTER_WINDOW_MS).toISOString();
  const existing = await db
    .from("story_signals")
    .select("id, cluster_key")
    .gte("created_at", since)
    .is("duplicate_of", null)
    .limit(2000);
  if (existing.error) {
    return {
      ok: false,
      mode: "signals",
      error: `story_signals unavailable: ${existing.error.message}`,
      published: 0,
      candidates: intake.candidates,
    };
  }
  const clusterOwner = new Map<string, string>();
  for (const row of existing.data ?? []) clusterOwner.set(row.cluster_key, row.id);

  let inserted = 0;
  let clustered = 0;
  const errors: string[] = [];
  const insertOne = async (d: (typeof drafts)[number], duplicateOf: string | null) => {
    const row = {
      source_name: d.lead.sourceName,
      source_url: d.lead.sourceUrl,
      normalized_url: normalizeUrl(d.lead.sourceUrl),
      title: d.title,
      title_key: d.lead.titleKey,
      card: d.card,
      source_published_at: d.publishedAtMs > 0 ? new Date(d.publishedAtMs).toISOString() : null,
      signal_score: d.score,
      entities: d.entities,
      primary_entity: d.primaryEntity,
      event_type: d.eventType,
      source_type: d.sourceType,
      materiality: d.materiality,
      suggested_desk: d.suggestedDesk,
      status: duplicateOf ? "duplicate" : "new",
      cluster_key: d.clusterKey,
      duplicate_of: duplicateOf,
    };
    const { data, error } = await db
      .from("story_signals")
      .upsert(row, { onConflict: "normalized_url", ignoreDuplicates: true })
      .select("id");
    if (error) {
      errors.push(`${d.title}: ${error.message}`);
      return null;
    }
    // Recorded as "held" so the legacy writer path never picks it up either.
    await markLeadProcessed(d.lead, "held");
    return data?.[0]?.id ?? null;
  };

  for (const d of kept) {
    const owner = clusterOwner.get(d.clusterKey) ?? null;
    const id = await insertOne(d, owner);
    if (id) {
      inserted += 1;
      if (owner) clustered += 1;
      else clusterOwner.set(d.clusterKey, id);
    }
  }
  for (const { signal } of duplicates) {
    const owner = clusterOwner.get(signal.clusterKey) ?? null;
    if (await insertOne(signal, owner)) clustered += 1;
  }

  return {
    ok: errors.length === 0,
    mode: "signals",
    published: 0,
    feedsAttempted: intake.feedsAttempted,
    feedErrors: intake.feedErrors,
    candidates: intake.candidates,
    skippedAsTaken: intake.skipped,
    signalsWritten: inserted,
    clusteredAsDuplicate: clustered,
    errors,
  };
}
