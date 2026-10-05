const SKIP_TITLE_RE =
  /\b(stocks to (buy|watch)|what to watch|our \d+-stock portfolio|best (credit cards|savings accounts)|these \d+ stocks)\b/i;

const CJK_OR_HANGUL_RE = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/;

const NEAR_DUPE_STOPWORDS = new Set([
  "that",
  "with",
  "from",
  "this",
  "have",
  "been",
  "will",
  "into",
  "over",
  "more",
  "than",
  "after",
  "their",
  "about",
  "for",
  "and",
  "the",
]);

export function isMostlyEnglishTitle(title: string): boolean {
  if (CJK_OR_HANGUL_RE.test(title)) return false;
  const letters = title.match(/[A-Za-z]/g)?.length ?? 0;
  const compact = title.replace(/\s+/g, "");
  if (letters < 12) return false;
  return letters / Math.max(1, compact.length) >= 0.55;
}

export function isUsableLeadItem(title: string, link: string): boolean {
  return (
    title.length >= 16 &&
    /^https?:\/\//i.test(link) &&
    !SKIP_TITLE_RE.test(title) &&
    isMostlyEnglishTitle(title)
  );
}

export function significantTitleTokens(titleKey: string): string[] {
  return titleKey
    .split(" ")
    .filter((token) => token.length >= 4 && !NEAR_DUPE_STOPWORDS.has(token));
}

/** News-feed items older than this, or with no source timestamp, are not written. */
export const SOURCE_MAX_AGE_MS = 48 * 60 * 60 * 1000;

/**
 * Prefer the item's own pubDate / published / updated time.
 * A missing timestamp is not invented: news feeds skip it.
 */
export function sourceTimestampSkipReason(publishedAtMs: number, now = Date.now()): string | null {
  if (!publishedAtMs || !Number.isFinite(publishedAtMs)) return "source date unknown";
  if (now - publishedAtMs > SOURCE_MAX_AGE_MS) return "source older than 48h";
  return null;
}

/**
 * A lead note with no Published line falls through (the local test fixture).
 * An explicit unknown or unparseable date is skipped, same as a stale feed item.
 */
export function leadPublishedSkipReason(
  publishedAt: string | null | undefined,
  now = Date.now(),
): string | null {
  if (publishedAt == null || publishedAt.trim() === "") return null;
  if (/^unknown$/i.test(publishedAt.trim())) return "source date unknown";
  const ms = Date.parse(publishedAt);
  if (!Number.isFinite(ms)) return "source date unknown";
  return sourceTimestampSkipReason(ms, now);
}

export function isPrNewswireFeed(name: string, url: string): boolean {
  return /pr\s*newswire/i.test(name) || /prnewswire\.com/i.test(url);
}

const MATERIAL_PR_RE =
  /\b(?:acquir(?:e|es|ed|ing)(?!\s+(?:customers|users|talent|clients|skills|attention|market share))|acquisition|merger|buyout|takeover|to buy|agreed to buy|to be acquired|definitive agreement|letter of intent|business combination|take-private|go-private|divest(?:iture|s|ed|ing)?|spin-?off|tender offer|majority stake|minority stake|controlling stake|(?:financing|funding) (?:round|facility|agreement|package)|series [a-e]\b|credit facility|term loan|revolving credit|private placement|\bipo\b|initial public offering|secondary offering|bond offering|notes offering|(?:raises?|secures?|closes?|invests?|invested) \$\s?\d|antitrust|hart-scott|\bhsr\b|federal trade commission|\bftc\b|department of justice|\bdoj\b|european commission|\bcma\b|regulator(?:y)? approval|consent decree|bankruptcy|chapter 11|chapter 7|\bearnings\b|profit warning|restatement|steps down|resigns as|nam(?:es|ed) .{0,40}chief executive|appoints .{0,40}chief executive)\b/i;

const AWARD_PR_RE =
  /\b(?:awards?|awarded|honou?rs?|honou?red|recognition|recogniz\w+|inner circle)\b/i;

const CLINIC_PR_RE =
  /\b(?:dermatolog\w*|clinics?|grand opening|ribbon[- ]cutting|med\s?spa)\b/i;

const AWARENESS_PR_RE =
  /\b(?:awareness|bullying|holiday cheer|shelter pets?|glow orange|prevention|scholarship|charity|donat\w+|in celebration of|campaign)\b/i;

const PAYROLL_PR_RE =
  /\b(?:payroll|employment)\b.{0,80}\b(?:data|index|report|survey|dump)\b|\b(?:data|index|report|survey|dump)\b.{0,80}\b(?:payroll|employment)\b/i;

const LAUNCH_PR_RE =
  /\b(?:launches?|launched|unveils?|unveiled|introduces?|introduced|debuts?|debuted|rolls out|rolled out)\b/i;

const RESEARCH_PR_RE =
  /\b(?:market worth|set to reach|price projection|marketsandmarkets)\b/i;

function softPr(kind: string): string {
  return `soft PR Newswire (${kind}; no deal, financing, or regulatory news)`;
}

/**
 * PR Newswire's M&A list still carries marketing, awards, clinic openings,
 * awareness campaigns, and product launches. Keep a release only when it
 * states a deal, financing, antitrust review, or other material corporate news.
 */
export function prNewswireSkipReason(title: string, summary = ""): string | null {
  const text = `${title} ${summary}`.replace(/<[^>]+>/g, " ");
  if (MATERIAL_PR_RE.test(text)) return null;
  if (AWARD_PR_RE.test(text)) return softPr("award or recognition");
  if (CLINIC_PR_RE.test(text)) return softPr("local clinic or practice opening");
  if (AWARENESS_PR_RE.test(text)) return softPr("awareness or promotional campaign");
  if (PAYROLL_PR_RE.test(text)) return softPr("payroll or employment data dump");
  if (LAUNCH_PR_RE.test(text)) return softPr("promotional launch");
  if (RESEARCH_PR_RE.test(text)) return softPr("promotional research");
  return "soft PR Newswire (no deal, financing, or regulatory news)";
}

export function intakeSkipReason(input: {
  sourceName: string;
  sourceUrl: string;
  title: string;
  summary?: string;
  publishedAt: number;
  now?: number;
}): string | null {
  const freshness = sourceTimestampSkipReason(input.publishedAt, input.now);
  if (freshness) return freshness;
  if (isPrNewswireFeed(input.sourceName, input.sourceUrl)) {
    return prNewswireSkipReason(input.title, input.summary ?? "");
  }
  return null;
}

export function titlesAreNearDuplicate(aKey: string, bKey: string): boolean {
  if (aKey === bKey) return true;
  const a = new Set(significantTitleTokens(aKey));
  const b = new Set(significantTitleTokens(bKey));
  if (a.size < 5 || b.size < 5) return false;

  let inter = 0;
  for (const token of a) {
    if (b.has(token)) inter += 1;
  }
  if (inter < 5) return false;

  const union = a.size + b.size - inter;
  return inter / union >= 0.5;
}
