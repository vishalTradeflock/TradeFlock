/**
 * Signal Desk helpers (pure, no I/O). A signal card is a <=120-word lead note
 * for a desk. It is NOT an article and is never published.
 */
export type SourceType = "primary_filing" | "regulator" | "company_ir" | "news" | "press_release" | "other";
export type Materiality = "low" | "medium" | "high";
export type SignalDesk = "macro" | "markets" | "ma" | "strategy" | "tech" | "retail";

export type SignalInput = {
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  publishedAtMs: number;
  desk: SignalDesk;
};

export type SignalDraft = {
  title: string;
  card: string;
  entities: string[];
  primaryEntity: string | null;
  eventType: string;
  sourceType: SourceType;
  materiality: Materiality;
  score: number;
  clusterKey: string;
  suggestedDesk: SignalDesk;
};

export const SIGNAL_CARD_MAX_WORDS = 120;

const EVENT_PATTERNS: [string, RegExp][] = [
  // 8-K item numbers first (EDGAR summaries list them).
  ["material_agreement", /\bItem 1\.01\b/],
  ["m_and_a", /\bItem 2\.01\b/],
  ["leadership_change", /\bItem 5\.02\b/],
  ["earnings", /\bItem 2\.02\b/],
  ["financing", /\bItem (2\.03|3\.02)\b/],
  ["m_and_a", /\b(acquir\w*|merger|buyout|takeover|to buy|agreed to buy|deal to buy)\b/i],
  ["earnings", /\b(earnings|quarterly results|q[1-4] (results|revenue)|revenue rose|revenue fell|guidance)\b/i],
  ["leadership_change", /\b(ceo|chief executive|cfo|chair(man|woman)?|steps down|resign\w*|appoint\w*|succession|names .* (ceo|president))\b/i],
  ["monetary_policy", /\b(fomc|federal reserve|interest rates?|rate (cut|hike)|monetary policy)\b/i],
  ["macro_data", /\b(cpi|inflation|payrolls|jobless|unemployment|gdp|retail sales|pce)\b/i],
  ["regulatory_action", /\b(sec charges|enforcement|antitrust|ftc|doj|lawsuit|settle\w*|fine[ds]?|consent order|recall)\b/i],
  ["financing", /\b(ipo|raises? \$|funding round|series [a-f]|bond (sale|offering)|debt offering)\b/i],
  ["layoffs", /\b(layoffs?|job cuts|cuts? \d[\d,]* jobs|restructuring)\b/i],
  ["product", /\b(launch\w*|unveil\w*|introduc\w*|rolls? out)\b/i],
  ["filing", /\b(8-k|10-k|10-q|form 4|s-1)\b/i],
];

const ENTITY_STOP = new Set([
  "The", "A", "An", "And", "For", "With", "From", "After", "Before", "Why", "How", "What", "New", "U.S.", "US",
  "Inc", "Corp", "Co", "Ltd", "LLC", "Says", "Report", "Reports", "Its", "This", "That", "As", "In", "On", "At",
  "To", "Of", "By", "Is", "Are", "Will", "Over", "Into", "Amid", "More", "Than", "First", "Week", "Today", "Filer", "Filed", "Item", "AccNo", "Size", "KB", "DE",
]);

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function clampWords(text: string, max = SIGNAL_CARD_MAX_WORDS): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= max) return words.join(" ");
  return `${words.slice(0, max).join(" ")}…`;
}

export function classifyEvent(text: string): string {
  for (const [name, re] of EVENT_PATTERNS) if (re.test(text)) return name;
  return "other";
}

/** Capitalised multi-word names and tickers. Heuristic; desks verify. */
export function extractEntities(text: string): string[] {
  const found = new Map<string, number>();
  const tickerRe = /\((?:NYSE|NASDAQ|Nasdaq|NYSEARCA|OTC)?:?\s*([A-Z]{1,5})\)/g;
  for (const m of text.matchAll(tickerRe)) found.set(`$${m[1]}`, (found.get(`$${m[1]}`) ?? 0) + 3);
  const nameRe = /\b([A-Z][a-zA-Z0-9&.'-]+(?:\s+(?:&\s+)?[A-Z][a-zA-Z0-9&.'-]+){0,3})/g;
  for (const m of text.matchAll(nameRe)) {
    const parts = m[1].split(/\s+/).filter((p) => !ENTITY_STOP.has(p.replace(/[.'’]+$/, "")));
    const name = parts.join(" ").replace(/['’]s$/, "").trim();
    if (name.length < 3 || ENTITY_STOP.has(name)) continue;
    found.set(name, (found.get(name) ?? 0) + 1);
  }
  return [...found.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name).slice(0, 8);
}

export function sourceTypeFor(sourceName: string, sourceUrl: string, text: string): SourceType {
  const host = (() => {
    try {
      return new URL(sourceUrl).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (/sec\.gov$/.test(host) && /\/Archives\/edgar\//i.test(sourceUrl)) return "primary_filing";
  if (/\b8-K\b/.test(sourceName) || /EDGAR/i.test(sourceName)) return "primary_filing";
  if (/(federalreserve\.gov|sec\.gov|bls\.gov|bea\.gov|treasury\.gov|ftc\.gov|justice\.gov)$/.test(host)) return "regulator";
  if (/(prnewswire|businesswire|globenewswire|accesswire)\./.test(host) || /\b(announces|announced today)\b/i.test(text)) {
    return "press_release";
  }
  if (host) return "news";
  return "other";
}

const HIGH_EVENTS = new Set(["m_and_a", "monetary_policy", "macro_data", "regulatory_action", "leadership_change"]);

export function materialityFor(text: string, eventType: string): Materiality {
  const big = /\$\s?\d+(?:\.\d+)?\s?(billion|bn|trillion)\b/i.test(text);
  if (big || (HIGH_EVENTS.has(eventType) && eventType !== "leadership_change")) return "high";
  if (HIGH_EVENTS.has(eventType) || /\$\s?\d+(?:\.\d+)?\s?(million|m)\b/i.test(text) || eventType === "earnings") {
    return "medium";
  }
  return "low";
}

/** 0-100. Primary sources and material events score higher; PR and stale items lower. */
export function scoreSignal(input: {
  sourceType: SourceType;
  materiality: Materiality;
  eventType: string;
  entities: string[];
  ageHours: number;
}): number {
  let score = 30;
  score += { primary_filing: 25, regulator: 20, company_ir: 10, news: 5, press_release: -15, other: 0 }[input.sourceType];
  score += { high: 25, medium: 12, low: 0 }[input.materiality];
  if (input.eventType === "other") score -= 10;
  if (input.eventType === "product") score -= 5;
  if (input.entities.length === 0) score -= 10;
  if (input.ageHours > 24) score -= 10;
  if (input.ageHours > 48) score -= 15;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function normalizeEntityKey(entity: string): string {
  return entity
    .toLowerCase()
    .replace(/\b(inc|corp|corporation|co|ltd|llc|plc|holdings|group)\b\.?/g, "")
    .replace(/[^a-z0-9$]+/g, " ")
    .trim();
}

/** Cluster = primary entity + event type; falls back to the title key. */
export function clusterKeyFor(primaryEntity: string | null, eventType: string, titleKey: string): string {
  if (primaryEntity && eventType !== "other") return `${normalizeEntityKey(primaryEntity)}|${eventType}`;
  return `title|${titleKey}`;
}

export function buildSignal(input: SignalInput, titleKey: string, now = Date.now()): SignalDraft {
  const text = `${input.title}. ${input.summary}`;
  const entities = extractEntities(text);
  const eventType = classifyEvent(text);
  const sourceType = sourceTypeFor(input.sourceName, input.sourceUrl, text);
  const materiality = materialityFor(text, eventType);
  const ageHours = input.publishedAtMs > 0 ? (now - input.publishedAtMs) / 3_600_000 : 0;
  const score = scoreSignal({ sourceType, materiality, eventType, entities, ageHours });
  const primaryEntity = entities[0] ?? null;
  const suggestedDesk: SignalDesk = eventType === "m_and_a" ? "ma"
    : eventType === "monetary_policy" || eventType === "macro_data" ? "macro"
    : eventType === "leadership_change" ? "strategy"
    : input.desk;
  const lead = clampWords(input.summary || input.title, 80);
  const card = clampWords(
    `${lead} | Source: ${input.sourceName} (${sourceType}). Event: ${eventType}. Entities: ${entities.slice(0, 4).join(", ") || "none found"}. Desk to answer: what would TradeFlock add beyond this source?`,
  );
  return {
    title: input.title,
    card,
    entities,
    primaryEntity,
    eventType,
    sourceType,
    materiality,
    score,
    clusterKey: clusterKeyFor(primaryEntity, eventType, titleKey),
    suggestedDesk,
  };
}

/** Within one batch: keep the highest-scoring signal per cluster; the rest are duplicates. */
export function clusterSignals<T extends { clusterKey: string; score: number }>(
  signals: T[],
): { kept: T[]; duplicates: { signal: T; of: T }[] } {
  const best = new Map<string, T>();
  for (const s of signals) {
    const cur = best.get(s.clusterKey);
    if (!cur || s.score > cur.score) best.set(s.clusterKey, s);
  }
  const kept = [...best.values()];
  const duplicates = signals.filter((s) => !kept.includes(s)).map((s) => ({ signal: s, of: best.get(s.clusterKey)! }));
  return { kept, duplicates };
}
