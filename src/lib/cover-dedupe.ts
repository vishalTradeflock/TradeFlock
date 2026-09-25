/**
 * Cover-image identity and dedupe rules. Dependency-free so the app, the
 * backfill script, and `node --test` can all share it.
 *
 * House rule: the same image must never appear on two different stories.
 */

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

export function isLegacyStockCover(url: string | null | undefined): boolean {
  const key = coverPhotoKey(url);
  return key !== null && LEGACY_STOCK_COVER_KEYS.has(key);
}

/** Keys that can never be handed to a new story (already used, or legacy stock). */
export function isCoverKeyTaken(key: string | null, used: ReadonlySet<string>): boolean {
  if (!key) return true;
  return used.has(key) || LEGACY_STOCK_COVER_KEYS.has(key);
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

const ROLE_WORDS = /\b(appoints?|names?|named|hires?|taps?|promotes?|elevates?|ceo|chief|president|chair(man|woman)?|cfo|coo|cto|board|succession|executive)\b/i;

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
  leadership: "business leader",
  energy: "energy industry",
  trending: "news",
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

/** Leading run of capitalized words before the first verb/role word: the company or person. */
function headlineSubject(words: string[]): string {
  const subject: string[] = [];
  for (const word of words) {
    if (!/^[\p{Lu}\p{N}]/u.test(word)) break;
    if (isStop(word)) {
      if (subject.length) break;
      continue;
    }
    subject.push(word);
    if (subject.length >= 4) break;
  }
  return subject.join(" ");
}

/** Capitalized non-leading run (e.g. the person named after "Names …"). */
function secondaryNames(words: string[], subject: string): string[] {
  const names: string[] = [];
  let run: string[] = [];
  const subjectWords = new Set(subject.split(" "));
  const flush = () => {
    if (run.length >= 2) names.push(run.join(" "));
    run = [];
  };
  words.forEach((word, index) => {
    if (index === 0) return;
    if (/^\p{Lu}/u.test(word) && !isStop(word) && !subjectWords.has(word)) run.push(word);
    else flush();
  });
  flush();
  return names;
}

/**
 * Ordered, story-specific Unsplash queries: company/person first, then
 * headline keywords, then a topic visual, then the desk.
 */
export function buildCoverSearchQueries(title: string, categorySlug?: string | null): string[] {
  const words = tokens(title);
  const subject = headlineSubject(words);
  const keywords = words.filter((word) => word.length >= 3 && !isStop(word)).map((w) => w.toLowerCase());
  const topic = TOPIC_HINTS.find(([pattern]) => pattern.test(title))?.[1] ?? "";
  const desk = DESK_HINTS[(categorySlug ?? "").trim().toLowerCase()] ?? "business";
  const role = ROLE_WORDS.test(title) ? "executive" : "";

  const queries = [
    subject && topic ? `${subject} ${topic}` : "",
    subject,
    ...secondaryNames(words, subject).slice(0, 1),
    keywords.slice(0, 4).join(" "),
    keywords.slice(0, 2).join(" "),
    topic,
    role && topic ? `${topic} ${role}` : "",
    role ? `${desk} ${role}` : "",
    `${desk} ${keywords[0] ?? ""}`.trim(),
    desk,
  ];

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const query of queries) {
    const clean = query.replace(/\s+/g, " ").trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    unique.push(clean);
  }
  return unique.slice(0, 8);
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
};

export type CoverReassignment<T extends CoverRow = CoverRow> = {
  row: T;
  key: string;
  reason: "legacy_stock" | "duplicate";
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
