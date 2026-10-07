/**
 * Wire Editor scorecard v1 (approved revision 3). Each criterion is scored
 * 0-5 and weighted to points; weights sum to 100. Mirrors the CHECK
 * constraints on public.editorial_verdicts (20261007_newsroom_phase1_tables.sql).
 */
export const SCORE_WEIGHTS = {
  added_value: 25,
  accuracy: 20,
  sourcing: 15,
  news_value: 10,
  context: 10,
  reader_value: 10,
  search_fit: 5,
  style: 5,
} as const;

export type Criterion = keyof typeof SCORE_WEIGHTS;
export type Scores = Record<Criterion, number>;

export const DECISIONS = [
  "PUBLISH",
  "REVISE",
  "SEND_BACK",
  "ESCALATE_TO_FEATURES",
  "HOLD_MONITOR",
  "UPDATE_EXISTING",
  "CONSOLIDATE",
  "REJECT",
] as const;
export type Decision = (typeof DECISIONS)[number];

export const PUBLISH_MIN_POINTS = 80;
export const PUBLISH_MIN_ADDED_VALUE = 3;
export const PUBLISH_REQUIRED_ACCURACY = 5;

/** Hard fails. HF9 always maps to REVISE (never a separate BLOCK outcome). */
export const HARD_FAILS: Record<string, string> = {
  HF1: "Fails Why TradeFlock? (restates the source; no added value)",
  HF2: "No primary source cited",
  HF3: "Unverified or wrong figure",
  HF4: "Fabricated quote, person, interview or first-hand claim",
  HF5: "Persona / invented byline",
  HF6: "Duplicate of existing TradeFlock coverage (should UPDATE or CONSOLIDATE)",
  HF7: "Press release or promotional copy presented as news",
  HF8: "No search intent that needs a new page",
  HF9: "House-style / mechanical gate failure (fixable: REVISE)",
  HF10: "Legal / defamation / embargo risk",
  HF11: "Stale: event older than its news value",
  HF12: "Missing AI disclosure or wrong author type",
};

export function totalPoints(scores: Scores): number {
  let total = 0;
  for (const key of Object.keys(SCORE_WEIGHTS) as Criterion[]) {
    const value = scores[key];
    total += (value * SCORE_WEIGHTS[key]) / 5;
  }
  return Math.round(total);
}

export function validateScores(scores: Partial<Scores>): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(SCORE_WEIGHTS) as Criterion[]) {
    const value = scores[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 5) {
      errors.push(`${key} must be an integer 0-5`);
    }
  }
  return errors;
}

export type VerdictCheck = { ok: true } | { ok: false; errors: string[] };

/** Same rules the database enforces; used by the API to fail fast with clear errors. */
export function checkVerdict(input: {
  decision: Decision;
  scores: Scores;
  hardFailsUnresolved: string[];
  isBreaking?: boolean;
  capOverrideReason?: string | null;
}): VerdictCheck {
  const errors = validateScores(input.scores);
  if (!DECISIONS.includes(input.decision)) errors.push(`unknown decision ${input.decision}`);
  for (const hf of input.hardFailsUnresolved) {
    if (!HARD_FAILS[hf]) errors.push(`unknown hard fail ${hf}`);
  }
  if (input.hardFailsUnresolved.includes("HF9") && input.decision !== "REVISE") {
    errors.push("HF9 maps to REVISE");
  }
  if (input.capOverrideReason && !input.isBreaking) {
    errors.push("cap override is only allowed for breaking news");
  }
  if (input.decision === "PUBLISH" && errors.length === 0) {
    const total = totalPoints(input.scores);
    if (total < PUBLISH_MIN_POINTS) errors.push(`total ${total} < ${PUBLISH_MIN_POINTS}`);
    if (input.scores.added_value < PUBLISH_MIN_ADDED_VALUE) errors.push("added_value must be >= 3/5");
    if (input.scores.accuracy !== PUBLISH_REQUIRED_ACCURACY) errors.push("accuracy must be 5/5");
    if (input.hardFailsUnresolved.length) {
      errors.push(`unresolved hard fails: ${input.hardFailsUnresolved.join(", ")}`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
