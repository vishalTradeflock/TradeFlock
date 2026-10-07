/**
 * Chief of Staff triage (pure, no I/O). Turns untriaged story_signals into one
 * outcome each: assign to a desk (creates a claim), escalate to Features, add
 * to a hub/timeline, monitor, duplicate, or reject. It never writes articles,
 * packets or verdicts and never publishes: assigned desks still file a
 * reporting packet and the Wire Editor stays the only gate.
 * Rules follow newsroom-redesign/chief-of-staff-triage-prompt.md.
 */
export type TriageDesk = "macro" | "markets" | "ma" | "strategy" | "tech" | "retail";
export type TriageOutcome = "assign" | "features" | "timeline" | "monitor" | "duplicate" | "reject";

export type TriageSignal = {
  id: string;
  title: string;
  signal_score: number;
  materiality: string;
  event_type: string;
  source_type: string;
  primary_entity: string | null;
  entities?: string[] | null;
  suggested_desk: string | null;
  cluster_key: string;
};

export type TriageContext = {
  /** claimKey(entity, event_type) of claims that are open or packet_filed. */
  openClaimKeys: Set<string>;
  /** Normalised titles of TradeFlock articles published recently. */
  coveredTitles: string[];
  /** Normalised watched entity names (boost). */
  watched: Set<string>;
  /** Signals per cluster_key seen in the recent window (theme size). */
  clusterSizes: Map<string, number>;
  /** Claims still allowed today (8/day publication budget minus today's claims). */
  claimBudget: number;
};

export type TriageDecision = {
  signalId: string;
  outcome: TriageOutcome;
  status: "claimed" | "timeline" | "monitor" | "duplicate" | "rejected";
  desk: TriageDesk | "features" | null;
  entity: string | null;
  rank: number;
  note: string;
};

export const DAILY_CLAIM_CAP = 8; // mirrors the 8/day publication cap
export const CLAIMS_PER_RUN = 3; // ~3 runs/day; expect 3-6 claims a day
export const ASSIGN_RANK = 100;
export const MONITOR_RANK = 75;

const DESKS: TriageDesk[] = ["macro", "markets", "ma", "strategy", "tech", "retail"];
const MATERIALITY_BONUS: Record<string, number> = { high: 15, medium: 5, low: 0 };
const SOURCE_BONUS: Record<string, number> = {
  primary_filing: 10, regulator: 10, company_ir: 5, news: 0, other: -5, press_release: -15,
};
const EVENT_BONUS: Record<string, number> = {
  m_and_a: 10, monetary_policy: 10, macro_data: 10, regulatory_action: 8, financing: 5,
  material_agreement: 3, layoffs: 3, earnings: 0, leadership_change: 0, filing: -5, product: -10, other: -15,
};
const DEFAULT_DESK: Record<string, TriageDesk> = {
  m_and_a: "ma", financing: "ma", material_agreement: "ma", monetary_policy: "macro", macro_data: "macro",
  leadership_change: "strategy", earnings: "markets", filing: "markets", regulatory_action: "ma", layoffs: "strategy",
  product: "tech",
};

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(\d{6,}\)|\((filer|subject|reporting)\)/g, " ")
    .replace(/\b(inc|corp|corporation|co|ltd|llc|plc|holdings|group|company|the)\b\.?/g, " ")
    .replace(/[^a-z0-9$]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** EDGAR titles look like "8-K - ACME CORP (0000123) (Filer)"; take the company. */
export function entityFor(signal: TriageSignal): string | null {
  const edgar = signal.title.match(/^\s*[\w/-]+\s+-\s+(.+?)\s*\(\d{6,}\)/);
  const raw = edgar?.[1] ?? signal.primary_entity ?? null;
  const name = raw?.trim();
  return name && name.length >= 2 ? name : null;
}

export function claimKey(entity: string, eventType: string): string {
  return `${normalizeName(entity)}|${eventType.toLowerCase()}`;
}

/** Normalised entity part of a claim key. */
export function entityOfKey(key: string): string {
  return key.slice(0, key.lastIndexOf("|"));
}

export function isCovered(entity: string | null, coveredTitles: string[]): boolean {
  if (!entity) return false;
  const key = normalizeName(entity);
  if (key.length < 4) return false;
  return coveredTitles.some((t) => ` ${t} `.includes(` ${key} `));
}

export function rankSignal(s: TriageSignal, ctx: Pick<TriageContext, "watched" | "coveredTitles">): number {
  const entity = entityFor(s);
  let rank = s.signal_score;
  rank += MATERIALITY_BONUS[s.materiality] ?? 0;
  rank += SOURCE_BONUS[s.source_type] ?? 0;
  rank += EVENT_BONUS[s.event_type] ?? 0;
  if (entity && ctx.watched.has(normalizeName(entity))) rank += 15;
  if (isCovered(entity, ctx.coveredTitles)) rank -= 10; // existing coverage: update/timeline, not a new page
  return rank;
}

function deskFor(s: TriageSignal): TriageDesk {
  const suggested = s.suggested_desk as TriageDesk | null;
  if (s.event_type in DEFAULT_DESK) return DEFAULT_DESK[s.event_type];
  return suggested && DESKS.includes(suggested) ? suggested : "markets";
}

/**
 * Decide every signal, highest rank first. Mutates ctx.openClaimKeys and
 * ctx.claimBudget as claims are planned so one run never double-assigns an event.
 */
export function triageSignals(signals: TriageSignal[], ctx: TriageContext): TriageDecision[] {
  const ranked = signals
    .map((s) => ({ s, rank: rankSignal(s, ctx) }))
    .sort((a, b) => b.rank - a.rank || b.s.signal_score - a.s.signal_score);
  const seenClusters = new Set<string>();
  let perRun = CLAIMS_PER_RUN;
  const out: TriageDecision[] = [];
  for (const { s, rank } of ranked) {
    const entity = entityFor(s);
    const base = { signalId: s.id, rank, entity };
    const key = entity ? claimKey(entity, s.event_type) : null;
    const decide = (outcome: TriageOutcome, status: TriageDecision["status"], desk: TriageDecision["desk"], note: string) =>
      out.push({ ...base, outcome, status, desk, note: `auto-triage: ${note}` });

    const ownedEntities = new Set([...ctx.openClaimKeys].map(entityOfKey));
    if ((key && ownedEntities.has(entityOfKey(key))) || seenClusters.has(s.cluster_key)) {
      decide("duplicate", "duplicate", null, "a desk already owns an open claim on this entity (one owner per event), or the cluster was handled this run");
      continue;
    }
    seenClusters.add(s.cluster_key);
    if (s.source_type === "press_release") {
      decide("reject", "rejected", null, "press release / promotional copy, no primary source");
      continue;
    }
    if (!entity || s.event_type === "other") {
      decide("reject", "rejected", null, "no identifiable entity or material event");
      continue;
    }
    const covered = isCovered(entity, ctx.coveredTitles);
    if (covered && s.materiality !== "high") {
      decide("timeline", "timeline", null, "minor development for an entity TradeFlock already covers; add to hub/timeline");
      continue;
    }
    const primary = s.source_type === "primary_filing" || s.source_type === "regulator";
    if (rank >= ASSIGN_RANK && (ctx.clusterSizes.get(s.cluster_key) ?? 1) >= 3 && ctx.claimBudget > 0 && perRun > 0) {
      ctx.claimBudget -= 1;
      perRun -= 1;
      if (key) ctx.openClaimKeys.add(key);
      decide("features", "claimed", "features", `developing theme (${ctx.clusterSizes.get(s.cluster_key)} signals); escalate to Features`);
      continue;
    }
    if (rank >= ASSIGN_RANK && primary && s.materiality !== "low" && ctx.claimBudget > 0 && perRun > 0) {
      const desk = deskFor(s);
      ctx.claimBudget -= 1;
      perRun -= 1;
      if (key) ctx.openClaimKeys.add(key);
      decide("assign", "claimed", desk, `rank ${rank}, ${s.materiality} ${s.event_type} from ${s.source_type}; desk ${desk} to report and file a packet`);
      continue;
    }
    if (rank >= MONITOR_RANK) {
      const why = rank >= ASSIGN_RANK ? "claim budget for today/this run is used" : "possibly material later; desk may claim manually";
      decide("monitor", "monitor", null, `rank ${rank}; ${why}`);
      continue;
    }
    decide("reject", "rejected", null, `rank ${rank} below monitor bar; no TradeFlock angle`);
  }
  return out;
}

/** Budget note for the run summary. */
export function budgetNote(decisions: TriageDecision[]): Record<string, number> {
  const note: Record<string, number> = {};
  for (const d of decisions) {
    const k = d.outcome === "assign" ? `assign_${d.desk}` : d.outcome;
    note[k] = (note[k] ?? 0) + 1;
  }
  return note;
}
