import { newsroomDb } from "@/lib/newsroom/db";
import {
  budgetNote,
  claimKey,
  DAILY_CLAIM_CAP,
  normalizeName,
  triageSignals,
  type TriageDecision,
  type TriageSignal,
} from "@/lib/newsroom/triage";

const WINDOW_MS = 72 * 60 * 60 * 1000;
const COVERAGE_DAYS = 30;
// Boost list; override with NEWSROOM_WATCHED_ENTITIES (comma separated).
const DEFAULT_WATCHED = [
  "Federal Reserve", "Apple", "Microsoft", "Nvidia", "Alphabet", "Amazon", "Meta Platforms", "Tesla",
  "JPMorgan Chase", "Berkshire Hathaway", "Walmart", "Costco", "Target", "Home Depot", "Intel", "AMD",
  "Broadcom", "OpenAI", "Boeing", "Exxon Mobil",
];

/** Start of today in America/New_York, as an ISO instant. */
export function nyDayStartIso(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const sinceMidnightMs = ((Number(p.hour) * 60 + Number(p.minute)) * 60 + Number(p.second)) * 1000;
  return new Date(Math.floor(now.getTime() / 1000) * 1000 - sinceMidnightMs).toISOString();
}

/**
 * Chief of Staff triage run. Only processes story_signals with status "new"
 * (not yet claimed or resolved). Writes signal statuses and story_claims;
 * never creates article rows, packets or verdicts, never publishes.
 */
export async function runTriage(opts: { dryRun?: boolean; limit?: number; signalIds?: string[] } = {}) {
  const db = newsroomDb();
  const limit = Math.min(opts.limit ?? 100, 200);
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const [pending, recent, open, today, covered] = await Promise.all([
    db.from("story_signals")
      .select("id, title, signal_score, materiality, event_type, source_type, primary_entity, entities, suggested_desk, cluster_key")
      .eq("status", "new").order("signal_score", { ascending: false }).limit(limit),
    db.from("story_signals").select("cluster_key").gte("created_at", since).limit(5000),
    db.from("story_claims").select("entity, event_type, signal_id").in("claim_status", ["open", "packet_filed"]).limit(5000),
    db.from("story_claims").select("id", { count: "exact", head: true }).gte("claimed_at", nyDayStartIso()),
    db.from("articles").select("title").eq("status", "published")
      .gte("published_at", new Date(Date.now() - COVERAGE_DAYS * 86_400_000).toISOString()).limit(2000),
  ]);
  const failed = [pending, recent, open, today, covered].find((r) => r.error);
  if (failed?.error) return { ok: false, mode: "triage", published: 0, articlesCreated: 0, error: failed.error.message };

  const claimedSignals = new Set((open.data ?? []).map((c) => c.signal_id).filter(Boolean));
  const only = opts.signalIds ? new Set(opts.signalIds) : null; // controlled test runs
  const signals = ((pending.data ?? []) as TriageSignal[]).filter((s) => !claimedSignals.has(s.id) && (!only || only.has(s.id)));
  const clusterSizes = new Map<string, number>();
  for (const r of recent.data ?? []) clusterSizes.set(r.cluster_key, (clusterSizes.get(r.cluster_key) ?? 0) + 1);
  const watchedList = (process.env.NEWSROOM_WATCHED_ENTITIES?.split(",") ?? DEFAULT_WATCHED).map((s) => normalizeName(s)).filter(Boolean);

  const decisions = triageSignals(signals, {
    openClaimKeys: new Set((open.data ?? []).map((c) => claimKey(String(c.entity), String(c.event_type)))),
    coveredTitles: (covered.data ?? []).map((a) => normalizeName(String(a.title ?? ""))),
    watched: new Set(watchedList),
    clusterSizes,
    claimBudget: Math.max(0, DAILY_CLAIM_CAP - (today.count ?? 0)),
  });
  const byId = new Map(signals.map((s) => [s.id, s]));

  const applied: (TriageDecision & { title: string; claimId?: string; error?: string; skipped?: string })[] = [];
  for (const d of decisions) {
    const s = byId.get(d.signalId)!;
    const row: (typeof applied)[number] = { ...d, title: s.title };
    applied.push(row);
    if (opts.dryRun) continue;
    // Conditional on status "new" so a manual triage in between always wins.
    const { data: moved, error } = await db.from("story_signals")
      .update({ status: d.status, triage_note: d.note.slice(0, 1000), updated_at: new Date().toISOString() })
      .eq("id", d.signalId).eq("status", "new").select("id");
    if (error) { row.error = error.message; continue; }
    if (!moved?.length) { row.skipped = "already triaged"; continue; }
    if (d.status !== "claimed" || !d.desk || !d.entity) continue;
    const claim = await db.from("story_claims")
      .insert({ signal_id: d.signalId, desk: d.desk, entity: d.entity, event_type: s.event_type, claimed_by: "signal_desk", note: d.note.slice(0, 1000) })
      .select("id").single();
    if (claim.error) {
      // 23505 = another desk already owns this entity+event (one owner per event).
      const status = claim.error.code === "23505" ? "duplicate" : "new";
      await db.from("story_signals")
        .update({ status, triage_note: claim.error.code === "23505" ? "auto-triage: entity+event already owned by a desk" : null, updated_at: new Date().toISOString() })
        .eq("id", d.signalId);
      row.outcome = status === "duplicate" ? "duplicate" : row.outcome;
      row.error = claim.error.code === "23505" ? undefined : claim.error.message;
      row.desk = status === "duplicate" ? null : row.desk;
      continue;
    }
    row.claimId = claim.data.id;
  }

  return {
    ok: applied.every((r) => !r.error),
    mode: "triage",
    dryRun: Boolean(opts.dryRun),
    published: 0,
    articlesCreated: 0,
    processed: applied.length,
    budget: budgetNote(applied),
    decisions: applied.map(({ signalId, title, outcome, desk, rank, note, claimId, skipped, error }) => ({
      signalId, title, outcome, desk, rank, note, claimId, skipped, error,
    })),
  };
}
