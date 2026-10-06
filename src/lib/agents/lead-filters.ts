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

/** Two leads that share this many distinctive names are the same story. */
export const TOPIC_ENTITY_OVERLAP = 2;

/** Same-story entity match only applies inside this window. URL/title dedupe stays at 7 days. */
export const TOPIC_DEDUPE_WINDOW_MS = 72 * 60 * 60 * 1000;

/**
 * Function words, folded (NFD, marks removed). A headline or article is
 * non-English when another language's hits beat English.
 */
const LANGUAGE_STOPWORDS: Record<string, readonly string[]> = {
  en: [
    "the", "and", "of", "to", "in", "for", "on", "with", "that", "is", "are", "was", "were",
    "be", "as", "at", "by", "from", "this", "an", "or", "it", "its", "has", "have", "had",
    "will", "not", "but", "which", "their", "they", "said", "after", "before", "about",
    "into", "over", "than", "also", "been", "would", "could", "more", "his", "her", "who",
    "what", "when", "where", "how", "its", "been", "were", "than", "then", "them", "these",
    "those", "such", "only", "other", "into", "over", "under", "between", "through",
  ],
  es: [
    "el", "la", "los", "las", "de", "del", "que", "en", "un", "una", "por", "con", "para",
    "su", "sus", "al", "se", "es", "como", "mas", "lo", "este", "esta", "pero", "hay",
    "son", "fue", "sobre", "entre", "cuando", "donde", "tambien", "desde", "hasta",
    "porque", "una", "sus", "les", "nos", "ya", "muy", "sin", "todo", "toda",
  ],
  fr: [
    "le", "la", "les", "des", "du", "et", "en", "un", "une", "que", "qui", "dans", "pour",
    "sur", "est", "au", "aux", "avec", "par", "pas", "plus", "sont", "cette", "ces",
    "son", "ses", "leur", "leurs", "mais", "ou", "nous", "vous", "ils", "elle", "elles",
    "comme", "dont", "apres", "avant", "entre", "chez", "ainsi", "etre", "dans", "une",
    "aux", "ses", "pour", "dans", "est", "sont", "fait", "ete", "ont", "aux", "afin",
  ],
  de: [
    "der", "die", "das", "und", "den", "dem", "des", "ein", "eine", "einer", "einem",
    "einen", "ist", "sind", "nicht", "mit", "von", "zu", "auf", "fur", "im", "am", "als",
    "auch", "sich", "nach", "bei", "aus", "oder", "wird", "wurde", "werden", "dass",
    "uber", "zum", "zur", "vom", "beim", "eine", "einer", "nicht", "sich", "nach", "vor",
    "bis", "nur", "noch", "kann", "durch", "gegen", "ohne", "zwischen",
  ],
  pt: [
    "os", "as", "de", "do", "da", "dos", "das", "que", "em", "um", "uma", "para", "com",
    "nao", "por", "se", "na", "no", "ao", "aos", "como", "mais", "foi", "sao", "sua",
    "seu", "seus", "suas", "esta", "este", "mas", "ou", "quando", "onde", "tambem",
    "entre", "sobre", "pela", "pelo", "uma", "dos", "das", "nao", "sua", "pelo",
  ],
  it: [
    "il", "lo", "la", "gli", "le", "di", "del", "della", "che", "un", "una", "per", "con",
    "non", "sono", "nel", "nella", "dei", "delle", "come", "piu", "anche", "sua", "suo",
    "questo", "questa", "ma", "quando", "dove", "tra", "fra", "dalla", "dallo", "sul",
    "sulla", "una", "degli", "delle", "nella", "sono", "stato", "stata", "questo",
  ],
  nl: [
    "de", "het", "een", "van", "en", "in", "is", "dat", "op", "te", "voor", "met", "die",
    "niet", "aan", "om", "er", "als", "maar", "bij", "ook", "nog", "tot", "uit", "naar",
    "over", "zijn", "werd", "wordt", "deze", "dit", "hun", "zij", "hij", "een", "niet",
    "voor", "naar", "ook", "werd", "worden", "hebben", "heeft",
  ],
  sk: [
    "sa", "na", "je", "ze", "pre", "ako", "nie", "su", "bol", "bola", "bolo", "ale", "od",
    "do", "pri", "po", "zo", "ci", "ktory", "ktora", "jeho", "jej", "ich", "tato", "tento",
    "tiez", "medzi", "alebo", "bude", "sme", "som", "tak", "aby", "ked", "kto", "co",
    "podla", "proti", "bez", "ani",
  ],
  cs: [
    "se", "na", "je", "ze", "pro", "jak", "neni", "jsou", "byl", "byla", "bylo", "ale",
    "od", "do", "pri", "po", "nebo", "ktery", "ktera", "jeho", "jeji", "take", "mezi",
    "bude", "jsme", "tento", "tato", "jsem", "aby", "kdyz", "kdo", "co", "podle", "proti",
    "bez", "ani", "jsou", "neni",
  ],
  pl: [
    "sie", "na", "nie", "ze", "do", "jest", "jak", "dla", "ale", "od", "po", "przy", "lub",
    "oraz", "jego", "jej", "ich", "ten", "ta", "to", "tego", "tej", "przez", "przed",
    "miedzy", "bedzie", "zostal", "ktory", "ktora", "oraz", "jest", "nie", "sie", "dla",
    "jako", "czy", "tylko", "moze", "zostanie",
  ],
};

const STOPWORD_INDEX: Map<string, string[]> = new Map();
for (const [language, words] of Object.entries(LANGUAGE_STOPWORDS)) {
  for (const word of words) {
    const folded = foldDiacritics(word).toLowerCase();
    const langs = STOPWORD_INDEX.get(folded) ?? [];
    if (!langs.includes(language)) langs.push(language);
    STOPWORD_INDEX.set(folded, langs);
  }
}

/**
 * Title-case and all-caps words that are not a company, person, or product.
 * Kept out of the entity overlap so "Global Market" does not glue two stories.
 */
const GENERIC_ENTITY = new Set([
  "the", "and", "for", "with", "from", "that", "this", "will", "has", "have", "had",
  "not", "but", "its", "his", "her", "who", "what", "when", "where", "how", "why",
  "new", "next", "says", "said", "announces", "announced", "unveils", "unveiled",
  "reports", "reported", "introduces", "introduced", "launches", "launched", "launch",
  "global", "market", "markets", "solution", "solutions", "company", "companies",
  "group", "groups", "inc", "corp", "llc", "ltd", "plc", "co", "million", "billion",
  "year", "years", "week", "weeks", "share", "shares", "stock", "stocks", "deal",
  "deals", "plan", "plans", "chief", "executive", "data", "delivery", "client",
  "clients", "world", "leading", "today", "partnership", "partner", "partners",
  "technology", "technologies", "digital", "platform", "platforms", "service",
  "services", "financial", "finance", "business", "industry", "international",
  "national", "american", "update", "updates", "first", "second", "third", "quarter",
  "revenue", "profit", "growth", "high", "major", "energy", "health", "healthcare",
  "medical", "software", "cloud", "artificial", "intelligence", "based", "across",
  "about", "more", "most", "best", "top", "big", "open", "press", "release", "news",
  "holdings", "limited", "corporation", "incorporated", "systems", "system", "capital",
  "management", "associates", "bank", "banks", "generation", "multi", "active", "skin",
  "aesthetic", "aesthetics", "collaboration", "deepens", "accelerate", "accelerates",
  "expanded", "expands", "acquires", "acquired", "acquisition", "merger", "mergers",
  "raises", "raise", "cuts", "cut", "holds", "hold", "names", "named", "appoints",
  "appointed", "joins", "join", "warns", "warning", "agrees", "agreed", "signs",
  "signed", "closes", "closed", "opens", "builds", "build", "sells", "sell", "sold",
  "buys", "buy", "wins", "win", "falls", "fall", "rises", "rise", "jumps", "jump",
  "hits", "hit", "posts", "post", "sees", "see", "makes", "make", "takes", "take",
  "offers", "offer", "seeks", "seek", "faces", "face", "sets", "set", "after", "over",
  "into", "amid", "before", "their", "they", "via", "per", "versus", "inc", "ltd",
  "ceo", "cfo", "coo", "cto", "gdp", "cpi", "ipo", "etf", "fda", "ftc", "doj", "sec",
  "usa", "eur", "usd", "gbp", "esg", "roi", "api", "gpu", "cpu", "nyse", "nasdaq",
  "amex", "lse", "tsx", "euronext", "prnewswire", "businesswire", "reuters", "bloomberg",
  "cnbc", "techcrunch", "forbes", "associated", "press", "source", "about", "forward",
  "looking", "statements", "statement", "contact", "contacts", "media", "investor",
  "investors", "analyst", "analysts", "percent", "billion", "million", "nasdaq",
  "street", "journal", "times", "post", "review", "report", "index", "board", "office",
  "department", "ministry", "committee", "university", "federal", "reserve", "united",
  "states", "america", "european", "europe", "china", "chinese", "japan", "india",
  "korea", "canada", "germany", "france", "britain", "london", "york", "paris",
  "tokyo", "berlin", "hong", "kong", "south", "north", "east", "west", "group",
  "holding", "holdings", "inc", "corp", "company", "limited", "plc", "sa", "ag", "nv",
  "se", "ab", "oy", "spa", "srl", "gmbh", "llc", "lp", "llp",
]);

export function isMostlyEnglishTitle(title: string): boolean {
  if (CJK_OR_HANGUL_RE.test(title)) return false;
  const letters = title.match(/[A-Za-z]/g)?.length ?? 0;
  const compact = title.replace(/\s+/g, "");
  if (letters < 12) return false;
  return letters / Math.max(1, compact.length) >= 0.55;
}

/** NFD, then drop combining marks so "Angélica" and "Angelica" compare equal. */
export function foldDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

function diacriticDensity(text: string): number {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return 0;
  let marked = 0;
  for (const letter of letters) {
    if (letter.normalize("NFD") !== letter) marked += 1;
  }
  return marked / letters.length;
}

function stopwordScores(tokens: readonly string[]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const token of tokens) {
    const languages = STOPWORD_INDEX.get(token);
    if (!languages) continue;
    for (const language of languages) {
      scores[language] = (scores[language] ?? 0) + 1;
    }
  }
  return scores;
}

/**
 * English vs es/fr/de/pt/it/nl/sk/cs/pl by stopword hits, plus diacritic density.
 * Short headlines need two clear foreign function words. Longer copy needs the
 * foreign hits to beat English. A single accented name does not fail an English story.
 */
export function isEnglishCopy(text: string): boolean {
  const tokens = foldDiacritics(text).toLowerCase().match(/[a-z]{2,}/g) ?? [];
  if (tokens.length === 0) return true;
  const scores = stopwordScores(tokens);
  const englishHits = scores.en ?? 0;
  let bestOther = 0;
  for (const [language, hits] of Object.entries(scores)) {
    if (language === "en") continue;
    if (hits > bestOther) bestOther = hits;
  }
  const density = diacriticDensity(text);
  if (tokens.length < 8) {
    if (bestOther >= 2 && bestOther > englishHits) return false;
    if (density >= 0.12 && englishHits === 0 && bestOther >= 1) return false;
    return true;
  }
  if (bestOther >= 3 && bestOther > englishHits && bestOther >= englishHits + 2) return false;
  if (density >= 0.06 && englishHits / tokens.length < 0.04 && bestOther >= englishHits) return false;
  return true;
}

export function isUsableLeadItem(title: string, link: string, summary = ""): boolean {
  if (title.length < 16 || !/^https?:\/\//i.test(link) || SKIP_TITLE_RE.test(title)) return false;
  if (!isMostlyEnglishTitle(title)) return false;
  return isEnglishCopy(summary ? `${title}\n${summary}` : title);
}

/**
 * Capitalised names, all-caps products, and exchange tickers. Diacritics folded.
 * Generic title-case news words (Market, Unveils, Global) are dropped.
 */
export function distinctiveEntityTokens(title: string): string[] {
  const folded = foldDiacritics(title);
  const found = new Set<string>();
  for (const match of folded.matchAll(/\((?:NYSE|NASDAQ|AMEX|LSE|TSX|EURONEXT)\s*:\s*([A-Z0-9]{1,6})\)/g)) {
    const ticker = match[1]?.toLowerCase();
    if (ticker && !GENERIC_ENTITY.has(ticker)) found.add(ticker);
  }
  for (const match of folded.matchAll(/\b[A-Z][A-Z0-9]{2,}\b/g)) {
    const token = match[0].toLowerCase();
    if (!GENERIC_ENTITY.has(token)) found.add(token);
  }
  for (const match of folded.matchAll(/\b[A-Z][a-z][A-Za-z0-9]{2,}\b/g)) {
    const token = match[0].toLowerCase();
    if (!GENERIC_ENTITY.has(token)) found.add(token);
  }
  return [...found];
}

export function sharedEntityTokens(a: string, b: string): string[] {
  const right = new Set(distinctiveEntityTokens(b));
  return distinctiveEntityTokens(a).filter((token) => right.has(token));
}

/** Same topic when two headlines share at least two distinctive entities (arcadis+autodesk). */
export function topicsShareEntities(a: string, b: string): boolean {
  return sharedEntityTokens(a, b).length >= TOPIC_ENTITY_OVERLAP;
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
