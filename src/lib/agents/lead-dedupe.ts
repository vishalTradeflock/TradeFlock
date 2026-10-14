import {
  TOPIC_DEDUPE_WINDOW_MS,
  titlesAreNearDuplicate,
  topicsShareEntities,
} from "./lead-filters.ts";
import { classifyEvent, clusterKeyFor, extractEntities } from "../newsroom/signals.ts";

export type RecentTopic = {
  title: string;
  at: number;
};

export type TakenKeys = {
  /** entity|event_type keys with an open story_claims owner (Phase 1). */
  claimedClusters?: Set<string>;
  titleKeys: Set<string>;
  urls: Set<string>;
  slugs: string[];
  recentTopics: RecentTopic[];
};

export type ArticleDedupeRow = {
  title: string;
  slug: string;
  created_at: string;
  /** Off-site canonical, when one is stored. There is no source_url column. */
  canonical_url?: string | null;
};

export type TakenCandidate = {
  title: string;
  summary: string;
  titleKey: string;
  normalizedUrl: string;
};

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

/**
 * Title, slug, and an optional canonical from one article row.
 * Source URLs for the wire live on `processed_leads.source_url` and
 * `story_signals.normalized_url`, which are selected separately.
 */
export function articleDedupeSignals(row: ArticleDedupeRow): {
  titleKey: string;
  slug: string;
  urls: string[];
  topic: RecentTopic | null;
} {
  const urls: string[] = [];
  const canonical = row.canonical_url?.trim();
  if (canonical && /^https?:\/\//i.test(canonical)) {
    urls.push(normalizeUrl(canonical));
  }
  const at = Date.parse(row.created_at);
  return {
    titleKey: normalizeTitleKey(row.title),
    slug: row.slug,
    urls,
    topic: row.title && Number.isFinite(at) ? { title: row.title, at } : null,
  };
}

export function isTaken(candidate: TakenCandidate, taken: TakenKeys): boolean {
  if (taken.claimedClusters?.size) {
    const text = `${candidate.title}. ${candidate.summary}`;
    const entity = extractEntities(text)[0] ?? null;
    const key = clusterKeyFor(entity, classifyEvent(text), candidate.titleKey);
    if (taken.claimedClusters.has(key)) return true;
  }
  if (taken.titleKeys.has(candidate.titleKey)) return true;
  if (taken.urls.has(candidate.normalizedUrl)) return true;

  const prefix = slugPrefix(candidate.title);
  if (prefix.length >= 12 && taken.slugs.some((slug) => slug.startsWith(prefix))) {
    return true;
  }

  for (const key of taken.titleKeys) {
    if (titlesAreNearDuplicate(candidate.titleKey, key)) return true;
  }

  const topicCutoff = Date.now() - TOPIC_DEDUPE_WINDOW_MS;
  for (const topic of taken.recentTopics) {
    if (topic.at < topicCutoff) continue;
    if (topicsShareEntities(candidate.title, topic.title)) return true;
  }

  return false;
}
