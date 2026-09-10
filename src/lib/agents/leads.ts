import { pickBalancedLeads } from "@/lib/agents/desk-balance";
import { resolveNewsFeeds, type NewsFeed } from "@/lib/agents/feeds";
import type { NewsLead } from "@/lib/agents/pipeline";
import { resolveWriterDesk, type WriterDesk } from "@/lib/agents/prompts";
import { parseFeedItems } from "@/lib/agents/rss";
import { createAdminClient } from "@/lib/supabase/admin";

const FEED_TIMEOUT_MS = 12_000;
const SUMMARY_LIMIT = 700;
const DEFAULT_DEDUPE_DAYS = 7;
const DEFAULT_BATCH_SIZE = 2;
const MAX_BATCH_SIZE = 3;
const FEED_USER_AGENT = "TradeFlock USA newsroom@tradeflock-usa-nine.vercel.app";

const MA_RE =
  /\b(acquir(?:e|es|ed|ing)|acquisition|merger|buyout|takeover|to buy|agreed to buy)\b/i;
const MACRO_RE =
  /\b(federal reserve|\bfed\b|fomc|interest rate|inflation|consumer price|cpi|payrolls|nonfarm|gdp|treasury yield)\b/i;
const STRATEGY_RE =
  /\b(named ceo|steps down|resigns as|chief executive|board chair|succession)\b/i;
const SKIP_TITLE_RE =
  /\b(stocks to (buy|watch)|what to watch|our \d+-stock portfolio|best (credit cards|savings accounts)|these \d+ stocks)\b/i;

export type IncomingLead = NewsLead & {
  sourceName: string;
  sourceUrl: string;
  titleKey: string;
};

export type FeedFetchError = {
  name: string;
  url: string;
  error: string;
};

export type LeadIntakeReport = {
  feedsAttempted: number;
  feedErrors: FeedFetchError[];
  feedWarning?: string;
  candidates: number;
  skipped: number;
  leads: IncomingLead[];
};

export type ProcessedLeadOutcome = "published" | "held";

type Candidate = {
  title: string;
  link: string;
  summary: string;
  publishedAt: number;
  sourceName: string;
  desk: WriterDesk;
  titleKey: string;
  normalizedUrl: string;
};

type TakenKeys = {
  titleKeys: Set<string>;
  urls: Set<string>;
  slugs: string[];
};

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function leadBatchSize(): number {
  const size = envInt("NEWS_LEAD_BATCH_SIZE", DEFAULT_BATCH_SIZE);
  return Math.min(MAX_BATCH_SIZE, Math.max(1, size));
}

export function normalizeTitleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function slugPrefix(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_)/i.test(key) || key === "ref") {
        parsed.searchParams.delete(key);
      }
    }
    parsed.hostname = parsed.hostname.replace(/^www\./, "");
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}

function refineDesk(desk: WriterDesk, title: string, summary: string): WriterDesk {
  const text = `${title} ${summary}`;
  if (MA_RE.test(text)) return "ma";
  if (STRATEGY_RE.test(title)) return "strategy";
  if (MACRO_RE.test(text) && desk !== "ma") return "macro";
  return desk;
}

function clipSummary(summary: string): string {
  if (summary.length <= SUMMARY_LIMIT) return summary;
  return `${summary.slice(0, SUMMARY_LIMIT).trim()}…`;
}

function toRawSource(candidate: Candidate): string {
  const published = candidate.publishedAt
    ? new Date(candidate.publishedAt).toISOString()
    : "unknown";
  const summary = clipSummary(candidate.summary);

  const lines = [
    `Source: ${candidate.sourceName}`,
    `URL: ${candidate.link}`,
    `Published: ${published}`,
    "",
    `Headline: ${candidate.title}`,
  ];
  if (summary) {
    lines.push("", "Summary:", summary);
  }
  lines.push(
    "",
    "Attribute the originating outlet and link. Use only the facts above as notes — do not invent quotes, figures, or a full reprint of the source article.",
  );
  return lines.join("\n");
}

function toIncomingLead(candidate: Candidate): IncomingLead {
  return {
    topic: candidate.title,
    category: candidate.desk,
    rawSource: toRawSource(candidate),
    sourceName: candidate.sourceName,
    sourceUrl: candidate.link,
    titleKey: candidate.titleKey,
  };
}

function isUsableItem(title: string, link: string): boolean {
  return title.length >= 16 && /^https?:\/\//i.test(link) && !SKIP_TITLE_RE.test(title);
}

function isMissingTableError(error: { message: string; code?: string }): boolean {
  const message = error.message.toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (message.includes("processed_leads") &&
      (message.includes("does not exist") ||
        message.includes("schema cache") ||
        message.includes("could not find")))
  );
}

async function fetchFeedXml(feed: NewsFeed): Promise<string> {
  const timeoutMs = feed.timeoutMs ?? FEED_TIMEOUT_MS;
  const response = await fetch(feed.url, {
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "User-Agent": FEED_USER_AGENT,
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const xml = await response.text();
  if (!xml.includes("<")) {
    throw new Error("Response was not XML");
  }
  return xml;
}

function candidatesFromFeed(feed: NewsFeed, xml: string): Candidate[] {
  return parseFeedItems(xml).flatMap((item) => {
    if (!isUsableItem(item.title, item.link)) return [];
    const titleKey = normalizeTitleKey(item.title);
    if (!titleKey) return [];
    return [
      {
        title: item.title,
        link: item.link,
        summary: item.summary,
        publishedAt: item.publishedAt,
        sourceName: feed.name,
        desk: refineDesk(feed.desk, item.title, item.summary),
        titleKey,
        normalizedUrl: normalizeUrl(item.link),
      },
    ];
  });
}

async function loadTakenKeys(sinceIso: string): Promise<TakenKeys> {
  const admin = createAdminClient();
  const titleKeys = new Set<string>();
  const urls = new Set<string>();
  const slugs: string[] = [];

  const articles = await admin
    .from("articles")
    .select("title, slug, body, excerpt, created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(400);

  if (articles.error) {
    throw new Error(`Article dedupe query failed: ${articles.error.message}`);
  }

  for (const row of articles.data ?? []) {
    titleKeys.add(normalizeTitleKey(row.title));
    slugs.push(row.slug);
    const haystack = `${row.body}\n${row.excerpt}`;
    for (const match of haystack.matchAll(/https?:\/\/[^\s"'<>]+/g)) {
      urls.add(normalizeUrl(match[0]));
    }
  }

  const processed = await admin
    .from("processed_leads")
    .select("title_key, source_url")
    .gte("created_at", sinceIso)
    .limit(500);

  if (processed.error) {
    if (!isMissingTableError(processed.error)) {
      throw new Error(`processed_leads query failed: ${processed.error.message}`);
    }
  } else {
    for (const row of processed.data ?? []) {
      if (row.title_key) titleKeys.add(row.title_key);
      if (row.source_url) urls.add(normalizeUrl(row.source_url));
    }
  }

  return { titleKeys, urls, slugs };
}

function isTaken(candidate: Candidate, taken: TakenKeys): boolean {
  if (taken.titleKeys.has(candidate.titleKey)) return true;
  if (taken.urls.has(candidate.normalizedUrl)) return true;

  const prefix = slugPrefix(candidate.title);
  if (prefix.length >= 12 && taken.slugs.some((slug) => slug.startsWith(prefix))) {
    return true;
  }

  return false;
}

function dedupeCandidates(items: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  const unique: Candidate[] = [];

  for (const item of items) {
    if (seen.has(item.titleKey) || seen.has(item.normalizedUrl)) continue;
    seen.add(item.titleKey);
    seen.add(item.normalizedUrl);
    unique.push(item);
  }

  unique.sort((a, b) => b.publishedAt - a.publishedAt);
  return unique;
}

function requiredFeedsFailed(feeds: NewsFeed[], feedErrors: FeedFetchError[]): boolean {
  const required = feeds.filter((feed) => !feed.optional);
  if (required.length === 0) {
    return feeds.length > 0 && feedErrors.length === feeds.length;
  }
  return required.every((feed) =>
    feedErrors.some((error) => error.name === feed.name && error.url === feed.url),
  );
}

async function loadRecentPublishedDesks(): Promise<WriterDesk[]> {
  try {
    const admin = createAdminClient();
    const processed = await admin
      .from("processed_leads")
      .select("desk")
      .eq("outcome", "published")
      .order("created_at", { ascending: false })
      .limit(30);

    if (processed.error) {
      if (!isMissingTableError(processed.error)) {
        console.error(`[leads] recent desk query failed: ${processed.error.message}`);
      }
      return [];
    }

    return (processed.data ?? []).flatMap((row) => {
      if (!row.desk) return [];
      return [resolveWriterDesk(row.desk)];
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error(`[leads] recent desk query failed: ${message}`);
    return [];
  }
}

export async function collectFreshLeads(limit = leadBatchSize()): Promise<LeadIntakeReport> {
  const { feeds, warning } = resolveNewsFeeds();
  const feedErrors: FeedFetchError[] = [];
  const gathered: Candidate[] = [];

  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const xml = await fetchFeedXml(feed);
      return candidatesFromFeed(feed, xml);
    }),
  );

  results.forEach((result, index) => {
    const feed = feeds[index];
    if (!feed) return;
    if (result.status === "fulfilled") {
      gathered.push(...result.value);
      return;
    }
    const error = result.reason instanceof Error ? result.reason.message : "Feed fetch failed";
    feedErrors.push({ name: feed.name, url: feed.url, error });
    console.error(`[leads] ${feed.name} failed: ${error}`);
  });

  if (gathered.length === 0 && requiredFeedsFailed(feeds, feedErrors)) {
    throw new Error(
      `Required news feeds failed: ${feedErrors.map((item) => `${item.name} (${item.error})`).join("; ")}`,
    );
  }

  const unique = dedupeCandidates(gathered);
  const since = new Date(
    Date.now() - envInt("NEWS_LEAD_DEDUPE_DAYS", DEFAULT_DEDUPE_DAYS) * 24 * 60 * 60 * 1000,
  ).toISOString();
  const [taken, recentDesks] = await Promise.all([loadTakenKeys(since), loadRecentPublishedDesks()]);
  const fresh = unique.filter((item) => !isTaken(item, taken));
  const leads = pickBalancedLeads(fresh, Math.max(1, limit), recentDesks).map(toIncomingLead);

  return {
    feedsAttempted: feeds.length,
    feedErrors,
    feedWarning: warning,
    candidates: unique.length,
    skipped: unique.length - fresh.length,
    leads,
  };
}

export async function markLeadProcessed(lead: IncomingLead, outcome: ProcessedLeadOutcome) {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("processed_leads").insert({
      title: lead.topic,
      title_key: lead.titleKey,
      source_url: lead.sourceUrl,
      source_name: lead.sourceName,
      desk: lead.category,
      outcome,
    });

    if (error && !isMissingTableError(error)) {
      console.error(`[leads] failed to record processed lead: ${error.message}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error(`[leads] failed to record processed lead: ${message}`);
  }
}
