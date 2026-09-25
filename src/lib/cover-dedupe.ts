/**
 * Cover-image identity and dedupe rules. Dependency-free so the app, the
 * backfill script, and `node --test` can all share it.
 *
 * House rule: the same image must never appear on two different stories.
 */
import { kebabHaystack, looksLikeSuccessInsightsListicle, SUCCESS_INSIGHTS_SLUG } from "./success-insights.ts";

const UNSPLASH_HOST = /^https?:\/\/(images|plus)\.unsplash\.com\//;
const UNSPLASH_PHOTO = /(?:premium_)?photo-[A-Za-z0-9_-]+/;

/**
 * Normalized identity for a cover URL.
 * - Unsplash CDN: `unsplash:photo-<id>` (crop/size/query params ignored).
 * - Anything else: lowercased host + path, scheme / `www.` / query / hash dropped.
 *
 * Mirrors `public.cover_photo_key(text)` in
 * supabase/migrations/20260925_unique_cover_photo.sql — keep them in sync.
 */
export function coverPhotoKey(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const withoutQuery = trimmed.split("#")[0].split("?")[0];
  const lower = withoutQuery.toLowerCase();
  if (UNSPLASH_HOST.test(lower)) {
    const photo = withoutQuery.match(UNSPLASH_PHOTO);
    if (photo) return `unsplash:${photo[0]}`;
  }
  const key = lower.replace(/^https?:\/\/(www\.)?/, "");
  return key || null;
}

/**
 * Legacy static stock photos (old global fallback + the 25-photo desk pool).
 * They were stamped onto hundreds of stories, so they are never a real cover:
 * render shows the neutral card instead, and the backfill replaces them.
 */
export const LEGACY_STOCK_COVER_URLS = [
  // Old FALLBACK_COVER_IMAGE (glass skyscrapers) — 220 stories as of 2026-09-25.
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab",
  // Tech / AI
  "https://images.unsplash.com/photo-1558494949-ef010cbdcc31",
  "https://images.unsplash.com/photo-1518770660439-4636190af475",
  "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158",
  "https://images.unsplash.com/photo-1550751827-4bd374c3f58b",
  "https://images.unsplash.com/photo-1518773553398-650c184e0bb3",
  "https://images.unsplash.com/photo-1485827404703-89b55fcc595e",
  "https://images.unsplash.com/photo-1581092160562-40aa08e78837",
  // Markets / Trading
  "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3",
  "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f",
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71",
  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e",
  "https://images.unsplash.com/photo-1514565131-fce0801e5785",
  // Finance / Banking
  "https://images.unsplash.com/photo-1554224155-6726b3ff858f",
  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40",
  "https://images.unsplash.com/photo-1565514020176-b31d2542ed3e",
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d",
  "https://images.unsplash.com/photo-1526304640173-94cb2232017e",
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f",
  // Leadership
  "https://images.unsplash.com/photo-1521737711867-e3b973223fbd",
  "https://images.unsplash.com/photo-1556761175-5973dc0f32e7",
  "https://images.unsplash.com/photo-1497366216548-37526070297c",
  "https://images.unsplash.com/photo-1475721027785-f74eccf877e2",
  "https://images.unsplash.com/photo-1573164713714-d95e436ab8d6",
  "https://images.unsplash.com/photo-1559136555-9303baea8ebd",
] as const;

export const LEGACY_STOCK_COVER_KEYS: ReadonlySet<string> = new Set(
  LEGACY_STOCK_COVER_URLS.map((url) => coverPhotoKey(url) as string),
);

/**
 * Success Insights profiles whose covers were chosen by searching Unsplash
 * for the person's name. Re-picked once, and only while the live cover is
 * still one of the photos that run assigned (see NAME_QUERY_PHOTO_IDS).
 */
export const NAME_QUERY_REDO_SLUGS = [
  "jennifer-holmgren-visionary-ceos-to-watch-in-2026",
  "dr-henry-nkumbe-visionary-ceos-to-watch-in-2026",
  "surya-kiran-satyavolu-visionary-ceos-to-watch-in-2026",
  "joseph-frankie-visionary-ceos-to-watch-in-2026",
  "juan-ignacio-rubiolo-most-innovative-global-coos-2026",
  "tom-cyriac-most-innovative-global-coos-2026",
  "pawel-swiatek-most-innovative-global-coos-2026",
  "pua-seck-guan-most-innovative-global-coos-2026",
  "vanity-inceptions-llc-visionary-ceos-to-watch-in-2026",
  "marco-nocivelli-visionary-ceos-to-watch-in-2026",
  "artem-gonchakov-visionary-ceos-to-watch-in-2026",
  "wallapa-tangsopa-most-innovative-global-coos-2026",
  "yasmeen-muhtaseb-most-innovative-global-coos-2026",
] as const;

/** Unsplash photo ids assigned by those person-name searches. Not 1:1 with the slugs. */
export const NAME_QUERY_PHOTO_IDS = [
  "photo-1560760253-6fb641776da9",
  "photo-1688120320082-f23f0c1425be",
  "photo-1740456967592-c0e88cf27fbc",
  "photo-1562788869-4ed32648eb72",
  "photo-1612463220657-40677cd64db4",
  "photo-1643324529323-63ddfbf1f607",
  "photo-1666860528399-d9903ec566f6",
  "photo-1679824243168-abc189878d79",
  "photo-1589829068065-20154e8f9642",
  "photo-1646296066880-c61cac79470b",
  "photo-1758518727984-17b37f2f0562",
  "photo-1589519160732-57fc498494f8",
  "photo-1529579134665-75dfc9c5ccef",
] as const;

const NAME_QUERY_PHOTO_KEYS: ReadonlySet<string> = new Set(
  NAME_QUERY_PHOTO_IDS.map((id) => `unsplash:${id}`),
);

export function isLegacyStockCover(url: string | null | undefined): boolean {
  const key = coverPhotoKey(url);
  return key !== null && LEGACY_STOCK_COVER_KEYS.has(key);
}

/** True when this URL is one of the stranger portraits assigned by a person-name search. */
export function isNameQueryPhoto(url: string | null | undefined): boolean {
  const key = coverPhotoKey(url);
  return key !== null && NAME_QUERY_PHOTO_KEYS.has(key);
}

/**
 * The slug still needs a one-time re-pick: it is on the redo list and its
 * current cover is one of the photos that person-name search assigned.
 * After the cover changes, this returns false, so each slug is redone once.
 */
export function needsNameQueryRedo(
  row: { slug?: string | null; cover_image_url?: string | null },
  slugs: readonly string[] = NAME_QUERY_REDO_SLUGS,
): boolean {
  const slug = row.slug?.trim().toLowerCase() ?? "";
  if (!slug || !slugs.some((item) => item.toLowerCase() === slug)) return false;
  return isNameQueryPhoto(row.cover_image_url);
}

/** Keys that can never be handed to a new story (already used, legacy stock, or a known wrong portrait). */
export function isCoverKeyTaken(key: string | null, used: ReadonlySet<string>): boolean {
  if (!key) return true;
  return used.has(key) || LEGACY_STOCK_COVER_KEYS.has(key) || NAME_QUERY_PHOTO_KEYS.has(key);
}

/** First candidate URL whose identity is not taken. Candidates are tried in order. */
export function pickFirstUnusedCover(
  candidates: readonly (string | null | undefined)[],
  used: ReadonlySet<string>,
): { url: string; key: string } | null {
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.trim()) continue;
    const key = coverPhotoKey(candidate);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (!isCoverKeyTaken(key, used)) return { url: candidate.trim(), key };
  }
  return null;
}

/** Render-time: first story in a list keeps a cover; later repeats get "" (neutral card). */
export function blankRepeatedCovers<T extends { cover_image_url?: string | null }>(
  articles: readonly T[],
): T[] {
  const seen = new Set<string>();
  return articles.map((article) => {
    const key = coverPhotoKey(article.cover_image_url);
    if (!key) return { ...article, cover_image_url: "" };
    if (seen.has(key)) return { ...article, cover_image_url: "" };
    seen.add(key);
    return article;
  });
}

// ---------------------------------------------------------------------------
// Story-specific Unsplash search terms
//
// Never search Unsplash for a person's name. A photo of a random stranger
// must not run as the portrait of a CEO.
//
// Heuristic — company (kept) vs person (dropped):
// 1. Known company / ticker allowlist (Nvidia, Microsoft, BlackRock, …).
//    A token on this list is never treated as a person's name. A multi-word
//    company is kept when the whole phrase is listed ("Goldman Sachs"), so
//    one allowlisted word does not rescue a personal name beside it.
// 2. Corporate-suffix adjacency. A capitalized run next to Inc, Corp, LLC,
//    Ltd, PLC, Group, Holdings, Bank, Labs, Partners, Capital, Logistics,
//    or Industries is a company ("Constellation Cold Logistics",
//    "Vanity Inceptions LLC").
// 3. News grammar. The leading capitalized run before an appointment verb
//    (Names, Appoints, Hires, Taps, Promotes, …) is the company, unless it
//    starts with an honorific. Capitalized runs after that verb are people.
// 4. Any other run of two or more capitalized words, an honorific (Dr, Mr,
//    Mrs, Ms, Prof, …) plus a name, an initial, or a token from an explicit
//    person/subject name is a person and is removed. Success Insights list
//    profiles usually title the story with just the person's name
//    ("Tom Cyriac", "Dr Henry Nkumbe Visionary"); those titles contribute
//    no name tokens.
// 5. A single capitalized token that is not an honorific is kept. In a news
//    headline that is usually a company we have not listed.
//
// Profile stories search places and objects (modern office, boardroom,
// city skyline at dusk, the list theme, industry terms). The Unsplash search
// API has no "exclude portraits" parameter; the picker drops hits whose alt
// text reads as a portrait. A fixed ladder of generic, non-person business
// queries is always available so a story still has something to search.
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set(
  `a an and are as at be by for from has have in into is it its of on or over the to under up with
  without after before amid about against as new says said will would could may might more most than
  that this these those their them they his her how why what when where who whose which while inside
  report reports reported update updates first year years week month quarter record us u.s usa
  inc corp corporation co ltd llc plc group holdings company companies announces announced announce
  appoints appointed appoint names named name hires hired taps tapped promotes promoted elevates
  launches launched launch unveils unveiled introduces introduced debuts expands expand opens opened
  secures secured signs signed declares declared reaches receives selected recognized sets set joins
  joined adds added becomes become faces face gets get takes take makes make brings bring issues
  issued proposes proposed requests requested releases released publishes published grants granted
  reminds invites warns targets offers highlights details outlines shows show plans plan push pushes
  its chief executive officer ceo cfo coo cto president chair chairman chairwoman director head vice
  senior board`.split(/\s+/),
);

/** Appointment verbs: the capitalized run before one of these is the company, not the person. */
const APPOINTMENT_VERB =
  /\b(appoints?|appointed|names?|named|hires?|hired|taps?|tapped|promotes?|promoted|elevates?|elevated)\b/i;

const HONORIFICS = new Set([
  "dr",
  "doctor",
  "mr",
  "mrs",
  "ms",
  "miss",
  "mx",
  "prof",
  "professor",
  "sir",
  "dame",
  "hon",
  "honorable",
  "rev",
  "reverend",
]);

const CREDENTIALS = new Set(["phd", "md", "mba", "jd", "esq", "jr", "sr", "ii", "iii", "iv"]);

/** Legal suffixes mark a company but are poor search terms on their own. */
const LEGAL_SUFFIXES = new Set([
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "co",
  "ltd",
  "llc",
  "plc",
  "llp",
  "lp",
  "limited",
  "gmbh",
]);

/** Words that sit on a company name (including industry words like Logistics). */
const CORPORATE_SUFFIXES = new Set([
  ...LEGAL_SUFFIXES,
  "group",
  "holdings",
  "holding",
  "company",
  "companies",
  "bank",
  "labs",
  "lab",
  "partners",
  "capital",
  "logistics",
  "industries",
  "industry",
  "ag",
  "sa",
  "nv",
]);

/**
 * Company and ticker tokens. Kept even when they sit inside a capitalized run
 * that otherwise looks like a given name + family name. Ambiguous surnames
 * (Ford, Morgan, Cook) are intentionally absent: a lone "Ford" in a headline
 * is still kept by the single-token rule, but "Harrison Ford" is not rescued.
 */
const COMPANY_TOKENS = new Set([
  "nvidia",
  "nvda",
  "microsoft",
  "msft",
  "blackrock",
  "apple",
  "google",
  "alphabet",
  "amazon",
  "meta",
  "tesla",
  "intel",
  "amd",
  "tsmc",
  "asml",
  "broadcom",
  "qualcomm",
  "samsung",
  "oracle",
  "salesforce",
  "adobe",
  "ibm",
  "cisco",
  "netflix",
  "uber",
  "baidu",
  "alibaba",
  "tencent",
  "jpmorgan",
  "blackstone",
  "walmart",
  "disney",
  "boeing",
  "exxon",
  "chevron",
  "pfizer",
  "moderna",
  "starbucks",
  "nike",
  "toyota",
  "accenture",
  "shopify",
  "coinbase",
  "snowflake",
  "palantir",
  "openai",
  "spacex",
  "anthropic",
  "ecopetrol",
  "constellation",
  "micron",
  "verizon",
  "comcast",
  "fedex",
  "costco",
  "pepsico",
  "visa",
  "mastercard",
  "paypal",
  "spotify",
  "airbnb",
  "coca-cola",
]);

/** Whole phrases only. "goldman sachs" is a company; "goldman" alone is not on the token list. */
const COMPANY_PHRASES = [
  "berkshire hathaway",
  "goldman sachs",
  "morgan stanley",
  "j p morgan",
  "jp morgan",
  "bank of america",
  "wells fargo",
  "johnson johnson",
  "procter gamble",
  "general electric",
  "general motors",
  "coca cola",
  "constellation cold logistics",
];

/** List-theme and role words. They describe the series, not the person. */
const THEME_WORDS = new Set([
  "visionary",
  "innovative",
  "global",
  "leaders",
  "leader",
  "leadership",
  "ceos",
  "ceo",
  "coos",
  "coo",
  "ctos",
  "cto",
  "cfos",
  "cfo",
  "chros",
  "chro",
  "hr",
  "watch",
  "empowering",
  "women",
  "woman",
  "entrepreneurs",
  "entrepreneur",
  "influential",
  "healthcare",
  "executives",
  "executive",
  "most",
]);

/** Non-person scenes. Also the deterministic fallback ladder, in this order. */
export const GENERIC_COVER_LADDER = [
  "modern office",
  "boardroom",
  "city skyline at dusk",
  "glass office towers",
  "financial district street",
  "corporate campus",
  "factory machinery",
  "cargo port at dusk",
  "research laboratory",
  "conference table",
] as const;

const PROFILE_SCENES = ["modern office", "boardroom", "city skyline at dusk"] as const;

/**
 * Try this many distinct queries (page 1) before paging an earlier query
 * or stepping onto the generic ladder. Keeps one story from spending the
 * Unsplash demo budget (50 requests/hour).
 */
export const MAX_PRIMARY_COVER_QUERIES = 3;

/** 3 query page-1 fetches, then one next page, then one ladder fetch. */
export const MAX_COVER_SEARCHES_PER_STORY = 5;

/** Visual fallbacks keyed by what the headline is about (checked in order). */
const TOPIC_HINTS: readonly [RegExp, string][] = [
  [/\b(oil|crude|opec|lng|natural gas|pipelines?|refiner\w*)\b|petrol/i, "oil refinery"],
  [/\b(solar|wind|grid|power|utility|energy|nuclear|turbine)/i, "power grid energy"],
  [/\b(chip|semiconductor|wafer|fabs?\b|foundry|gpu|nvidia|tsmc|asml)/i, "semiconductor chip"],
  [/\b(ai|llm|model|agent|robot|automation)\b/i, "artificial intelligence technology"],
  [/\b(law firm|lawsuit|class action|court|judge|securities fraud|sec )/i, "courthouse law"],
  [/\b(fed|federal reserve|treasury|yield|bond|rate|inflation)/i, "federal reserve economy"],
  [/\b(bank|lender|deposit|loan|credit|mortgage)/i, "bank building"],
  [/\b(stock|shares|equity|nasdaq|s&p|dow jones|ipos?\b|trading|exchange)/i, "stock market trading"],
  [/\b(crypto|bitcoin|token|stablecoin|blockchain)/i, "cryptocurrency"],
  [/\b(retail|store|shelf|shopping|consumer|grocery)/i, "retail store aisle"],
  [/\b(logistics|freight|shipping|warehouse|cold chain|supply chain|truck)/i, "logistics warehouse"],
  [/\b(airline|aviation|aircraft|airport|jet)/i, "airplane aviation"],
  [/\b(auto|car|ev|vehicle|tesla|ford|gm)\b/i, "electric vehicle"],
  [/\b(drug|pharma|biotech|clinical|health|hospital|medical)/i, "laboratory research"],
  [/\b(real estate|housing|rent|home|property)/i, "residential real estate"],
  [/\b(media|press|journalist|news|broadcast)/i, "newsroom press"],
];

const DESK_HINTS: Record<string, string> = {
  tech: "technology",
  technology: "technology",
  "ai-chips": "semiconductor",
  markets: "financial markets",
  finance: "finance",
  leadership: "corporate headquarters",
  "success-insights": "modern office",
  energy: "energy industry",
  trending: "business news",
};

function tokens(title: string): string[] {
  return title
    .replace(/[’']s\b/g, "")
    .split(/[^\p{L}\p{N}&.-]+/u)
    .map((word) => word.replace(/^[.\-&]+|[.\-&]+$/g, ""))
    .filter(Boolean);
}

function isStop(word: string) {
  return STOP_WORDS.has(word.toLowerCase());
}

function isHonorific(word: string) {
  return HONORIFICS.has(word.toLowerCase().replace(/\.$/, ""));
}

function isCredential(word: string) {
  return CREDENTIALS.has(word.toLowerCase().replace(/\.$/, ""));
}

function isThemeWord(word: string) {
  return THEME_WORDS.has(word.toLowerCase());
}

function isInitial(word: string) {
  return /^[\p{Lu}]\.?$/u.test(word);
}

function isCapitalized(word: string) {
  return /^\p{Lu}/u.test(word);
}

type WordRun = { words: string[]; startIndex: number; endIndex: number };

function capitalizedRuns(words: string[]): WordRun[] {
  const runs: WordRun[] = [];
  let current: string[] = [];
  let start = 0;
  const flush = (endIndex: number) => {
    if (current.length) runs.push({ words: current, startIndex: start, endIndex });
    current = [];
  };
  words.forEach((word, index) => {
    if (isCapitalized(word) && !isStop(word)) {
      if (!current.length) start = index;
      current.push(word);
    } else {
      flush(index - 1);
    }
  });
  flush(words.length - 1);
  return runs;
}

function hasFollowingCorporateSuffix(run: WordRun, words: string[]) {
  for (let index = run.endIndex + 1; index < words.length; index += 1) {
    const lower = words[index].toLowerCase();
    if (CORPORATE_SUFFIXES.has(lower)) return true;
    if (isStop(words[index])) continue;
    break;
  }
  return false;
}

function isLeadingCompanySubject(run: WordRun, words: string[]) {
  const first = words.findIndex((word) => !isStop(word));
  if (first === -1 || run.startIndex !== first) return false;
  if (run.words.some((word) => isHonorific(word))) return false;
  const rest = words.slice(run.endIndex + 1).join(" ");
  return APPOINTMENT_VERB.test(rest);
}

function isCompanyRun(run: WordRun, words: string[]) {
  const lower = run.words.map((word) => word.toLowerCase());
  if (lower.some((word) => CORPORATE_SUFFIXES.has(word))) return true;
  if (hasFollowingCorporateSuffix(run, words)) return true;
  if (lower.length === 1 && COMPANY_TOKENS.has(lower[0])) return true;
  if (lower.length >= 2 && lower.every((word) => COMPANY_TOKENS.has(word))) return true;
  if (COMPANY_PHRASES.includes(lower.join(" "))) return true;
  return isLeadingCompanySubject(run, words);
}

function phraseInTitle(words: string[], phrase: string) {
  const parts = phrase.split(" ");
  const lower = words.map((word) => word.toLowerCase());
  for (let index = 0; index <= lower.length - parts.length; index += 1) {
    if (parts.every((part, offset) => lower[index + offset] === part)) return index;
  }
  return -1;
}

/** Tokens that belong to a company name and must not be stripped as a person. */
function companyTokenSet(words: string[]) {
  const keep = new Set<string>();
  for (const phrase of COMPANY_PHRASES) {
    if (phraseInTitle(words, phrase) === -1) continue;
    for (const part of phrase.split(" ")) keep.add(part);
  }
  for (const run of capitalizedRuns(words)) {
    if (!isCompanyRun(run, words)) continue;
    for (const word of run.words) keep.add(word.toLowerCase());
  }
  for (const word of words) {
    const lower = word.toLowerCase();
    if (COMPANY_TOKENS.has(lower)) keep.add(lower);
  }
  return keep;
}

function isPurePersonTitle(title: string) {
  const words = tokens(title);
  const content = words.filter((word) => !isStop(word));
  if (!content.length || APPOINTMENT_VERB.test(title)) return false;
  if (capitalizedRuns(words).some((run) => isCompanyRun(run, words))) return false;
  const hay = ` ${words.map((word) => word.toLowerCase()).join(" ")} `;
  if (COMPANY_PHRASES.some((phrase) => hay.includes(` ${phrase} `))) return false;
  const nameParts = content.filter(
    (word) => !isHonorific(word) && !isInitial(word) && !isCredential(word) && !isThemeWord(word),
  );
  if (!nameParts.length) return false;
  if (nameParts.some((word) => COMPANY_TOKENS.has(word.toLowerCase()) || CORPORATE_SUFFIXES.has(word.toLowerCase()))) {
    return false;
  }
  if (nameParts.length > 5) return false;
  if (!nameParts.every((word) => isCapitalized(word))) return false;
  if (nameParts.length < 2 && !content.some((word) => isHonorific(word))) return false;
  return true;
}

export type CoverSearchContext = {
  slug?: string | null;
  /** Person / subject name when the article stores one. Articles have no such column; SI titles usually are the name. */
  personName?: string | null;
  company?: string | null;
  excerpt?: string | null;
  body?: string | null;
};

/** Success Insights, a listicle slug, or a title that is only a person's name. */
export function isProfileCoverStory(
  title: string,
  categorySlug?: string | null,
  context?: CoverSearchContext,
) {
  const slug = (categorySlug ?? "").trim().toLowerCase();
  if (slug === SUCCESS_INSIGHTS_SLUG) return true;
  if (looksLikeSuccessInsightsListicle(title, context?.slug)) return true;
  return isPurePersonTitle(title);
}

function bannedPersonTokens(words: string[], personName?: string | null) {
  const banned = new Set<string>();
  const companies = companyTokenSet(words);
  const ban = (word: string) => {
    const lower = word.toLowerCase();
    if (!lower || companies.has(lower) || isThemeWord(word) || isStop(word) || isHonorific(word)) return;
    banned.add(lower);
  };

  if (personName) {
    for (const word of tokens(personName)) {
      if (isHonorific(word) || isInitial(word) || isCredential(word) || isStop(word) || isThemeWord(word)) continue;
      banned.add(word.toLowerCase());
    }
  }

  if (isPurePersonTitle(words.join(" "))) {
    for (const word of words) ban(word);
  }

  for (const run of capitalizedRuns(words)) {
    if (isCompanyRun(run, words)) continue;
    const content = run.words.filter(
      (word) => !isHonorific(word) && !isInitial(word) && !isCredential(word) && !isThemeWord(word),
    );
    const personLike = run.words.some((word) => isHonorific(word)) || content.length >= 2;
    if (!personLike) continue;
    for (const word of content) ban(word);
  }
  return banned;
}

function plainText(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCompanyPhrase(words: string[]) {
  for (const phrase of [...COMPANY_PHRASES].sort((a, b) => b.length - a.length)) {
    const index = phraseInTitle(words, phrase);
    if (index === -1) continue;
    return words.slice(index, index + phrase.split(" ").length).join(" ");
  }
  const run = capitalizedRuns(words).find((candidate) => isCompanyRun(candidate, words));
  if (!run) return "";
  return run.words.filter((word) => !LEGAL_SUFFIXES.has(word.toLowerCase())).join(" ");
}

function cleanCompanyField(company: string, banned: ReadonlySet<string>) {
  return tokens(company)
    .filter((word) => {
      const lower = word.toLowerCase();
      return !banned.has(lower) && !isHonorific(word) && !isInitial(word) && !LEGAL_SUFFIXES.has(lower);
    })
    .join(" ");
}

function listTheme(title: string, slug?: string | null) {
  const hay = `${kebabHaystack(slug ?? "")} ${kebabHaystack(title)}`;
  if (/innovative-global-coos|global-coos|coos-to-watch/.test(hay)) return "global COOs";
  if (/visionary-ceos|ceos-to-watch/.test(hay)) return "visionary CEOs";
  if (/hr-leaders|chief-human/.test(hay)) return "HR leaders";
  if (/healthcare-executives/.test(hay)) return "healthcare";
  if (/empowering-women/.test(hay)) return "executive office";
  if (/entrepreneurs-to-watch/.test(hay)) return "startup office";
  if (/influential-leaders|leaders-to-watch/.test(hay)) return "corporate headquarters";
  return "";
}

function dedupeQueries(queries: readonly string[]) {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const query of queries) {
    const clean = query.replace(/\s+/g, " ").trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    unique.push(clean);
  }
  return unique;
}

/**
 * Ordered Unsplash queries for one story. Company and topic first for news;
 * offices, boardrooms, and skylines for profiles. Person-name tokens are absent.
 * The generic ladder is always appended.
 */
export function buildCoverSearchQueries(
  title: string,
  categorySlug?: string | null,
  context?: CoverSearchContext,
): string[] {
  const words = tokens(title);
  const banned = bannedPersonTokens(words, context?.personName);
  const profile = isProfileCoverStory(title, categorySlug, context);
  const topicSource = [title, context?.company, context?.excerpt, plainText(context?.body).slice(0, 2000)]
    .filter(Boolean)
    .join(" ");
  const topic = TOPIC_HINTS.find(([pattern]) => pattern.test(topicSource))?.[1] ?? "";
  const desk = DESK_HINTS[(categorySlug ?? "").trim().toLowerCase()] ?? "business";
  const fromField = context?.company ? cleanCompanyField(context.company, banned) : "";
  const companyPhrase = fromField || titleCompanyPhrase(words);
  const keywords = words
    .filter((word) => {
      const lower = word.toLowerCase();
      return word.length >= 3 && !isStop(word) && !banned.has(lower) && !isHonorific(word) && !isCredential(word);
    })
    .map((word) => word.toLowerCase());
  // Company tokens first so "Nvidia … Microsoft … BlackRock" is not crowded out by verbs.
  const orderedKeywords = [
    ...keywords.filter((word) => COMPANY_TOKENS.has(word)),
    ...keywords.filter((word) => !COMPANY_TOKENS.has(word)),
  ];
  const theme = listTheme(title, context?.slug);

  const specific: string[] = [];
  if (profile) {
    if (companyPhrase && topic) specific.push(`${companyPhrase} ${topic}`);
    else if (companyPhrase) specific.push(`${companyPhrase} headquarters`);
    if (topic) specific.push(topic);
    if (theme) {
      for (const scene of PROFILE_SCENES) specific.push(`${theme} ${scene}`);
    }
    for (const scene of PROFILE_SCENES) specific.push(scene);
    const topical = orderedKeywords.filter((word) => !isThemeWord(word) && !banned.has(word));
    if (topical.length) specific.push(topical.slice(0, 3).join(" "));
  } else {
    specific.push(
      companyPhrase && topic ? `${companyPhrase} ${topic}` : "",
      companyPhrase,
      orderedKeywords.slice(0, 4).join(" "),
      orderedKeywords.slice(0, 2).join(" "),
      topic,
      companyPhrase && desk ? `${companyPhrase} ${desk}` : "",
      `${desk} ${orderedKeywords[0] ?? ""}`.trim(),
      desk,
    );
  }

  return dedupeQueries([...specific, ...GENERIC_COVER_LADDER, desk]).slice(0, 12);
}

export type CoverSearchAttempt = { query: string; page: number };

/**
 * Page 1 of the first three queries, then page 2 of the first query, then the
 * first generic-ladder query that was not already tried. Capped so one story
 * cannot use the whole Unsplash hourly budget.
 */
export function planCoverSearchAttempts(
  queries: readonly string[],
  maxSearches = MAX_COVER_SEARCHES_PER_STORY,
): CoverSearchAttempt[] {
  const cleaned = dedupeQueries(queries);
  const primary = cleaned.slice(0, MAX_PRIMARY_COVER_QUERIES);
  const primaryKeys = new Set(primary.map((query) => query.toLowerCase()));
  const ladder = GENERIC_COVER_LADDER.filter((query) => !primaryKeys.has(query.toLowerCase()));
  const attempts: CoverSearchAttempt[] = [];
  const push = (query: string, page: number) => {
    if (!query) return;
    if (attempts.some((attempt) => attempt.page === page && attempt.query.toLowerCase() === query.toLowerCase())) {
      return;
    }
    attempts.push({ query, page });
  };
  for (const query of primary) push(query, 1);
  if (primary[0]) push(primary[0], 2);
  if (ladder[0]) push(ladder[0], 1);
  for (const query of primary.slice(1)) push(query, 2);
  for (const query of ladder.slice(1)) push(query, 1);
  return attempts.slice(0, Math.max(0, maxSearches));
}

// ---------------------------------------------------------------------------
// Backfill planning
// ---------------------------------------------------------------------------

export type CoverRow = {
  id: string;
  title: string;
  slug?: string | null;
  cover_image_url: string | null;
  published_at?: string | null;
  created_at?: string | null;
  category?: { slug?: string | null } | null;
  company?: string | null;
  excerpt?: string | null;
  /** Set when a caller has a person/subject name separate from the title. */
  personName?: string | null;
};

export type CoverChangeReason = "legacy_stock" | "duplicate" | "name_query" | "source_photo";

export type CoverReassignment<T extends CoverRow = CoverRow> = {
  row: T;
  key: string;
  reason: CoverChangeReason;
  keeper: T | null;
  shareCount: number;
};

function ageOf(row: CoverRow) {
  const at = Date.parse(row.published_at ?? row.created_at ?? "");
  return Number.isFinite(at) ? at : Number.MAX_SAFE_INTEGER;
}

function olderFirst(a: CoverRow, b: CoverRow) {
  return ageOf(a) - ageOf(b) || String(a.id).localeCompare(String(b.id));
}

/**
 * Which rows need a new cover: every legacy-stock row, plus every row that
 * shares a cover identity with an older story (the oldest keeps it).
 */
export function planCoverReassignments<T extends CoverRow>(rows: readonly T[]): CoverReassignment<T>[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = coverPhotoKey(row.cover_image_url);
    if (!key) continue;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  const plan: CoverReassignment<T>[] = [];
  for (const [key, group] of groups) {
    const sorted = [...group].sort(olderFirst);
    if (LEGACY_STOCK_COVER_KEYS.has(key)) {
      for (const row of sorted) {
        plan.push({ row, key, reason: "legacy_stock", keeper: null, shareCount: sorted.length });
      }
      continue;
    }
    if (sorted.length < 2) continue;
    const [keeper, ...rest] = sorted;
    for (const row of rest) {
      plan.push({ row, key, reason: "duplicate", keeper, shareCount: sorted.length });
    }
  }
  return plan.sort((a, b) => olderFirst(a.row, b.row));
}

/**
 * One-time re-picks for profiles whose cover was chosen by searching the
 * person's name. Only slugs whose current Unsplash id is still one of
 * NAME_QUERY_PHOTO_IDS are returned, in list order, so each slug is redone once.
 */
export function planNameQueryRedos<T extends CoverRow>(
  rows: readonly T[],
  slugs?: readonly string[],
): CoverReassignment<T>[] {
  const bySlug = new Map<string, T>();
  for (const row of rows) {
    const slug = row.slug?.trim().toLowerCase();
    if (slug && !bySlug.has(slug)) bySlug.set(slug, row);
  }
  const wanted = (slugs ?? NAME_QUERY_REDO_SLUGS).map((slug) => slug.trim().toLowerCase()).filter(Boolean);
  const plan: CoverReassignment<T>[] = [];
  const seen = new Set<string>();
  for (const slug of wanted) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    const row = bySlug.get(slug);
    if (!row || !needsNameQueryRedo(row, wanted)) continue;
    const key = coverPhotoKey(row.cover_image_url);
    if (!key) continue;
    plan.push({ row, key, reason: "name_query", keeper: null, shareCount: 1 });
  }
  return plan;
}
