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
