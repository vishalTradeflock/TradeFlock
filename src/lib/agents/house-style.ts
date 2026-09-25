import { factCheckFailures } from "./fact-check.ts";
import type { RelatedCandidate } from "./related-articles.ts";
import { toNewsArticleHref } from "../sanitize-article-body.ts";
import { isValidPublicSlug, sanitizeSlug, slugFromTitle } from "../studio/slug.ts";
import {
  sourceHrefInBody,
  stripTagsForWordCount,
  wireHygieneFailures,
  type LeadNotes,
} from "./wire-hygiene.ts";

export const TITLE_MAX_CHARS = 60;
export const SLUG_MAX_WORDS = 8;
export const SLUG_MAX_CHARS = 60;

const MINOR_WORDS = new Set([
  "a", "an", "the", "and", "but", "or", "nor", "for", "on", "at", "to", "from",
  "by", "of", "in", "with", "as", "vs", "via", "over", "into", "amid",
]);

const ACRONYMS = new Set([
  "AI", "CEO", "CFO", "COO", "CTO", "CMO", "CIO", "UK", "US", "EU", "ECB", "BOE",
  "IPO", "GDP", "CPI", "PPI", "SEC", "FTC", "DOJ", "IRS", "IMF", "ETF", "API",
  "NYSE", "ESG", "ROI", "HR", "VP", "SVP", "EVP", "OPEC", "NATO", "FDA", "FAA",
  "FCC", "FDIC", "OCC", "SBA", "G7", "G20", "PR", "IT", "ML", "LLM", "GPU", "CPU",
  "AWS", "IBM", "SAP", "HSBC", "UBS", "ING", "FOMC", "LSEG", "ONS",
]);

const SLUG_STOP = new Set([
  "a", "an", "the", "and", "or", "but", "of", "for", "to", "in", "on", "at", "by",
  "with", "from", "as", "after", "amid", "over", "into", "its", "that", "this",
  "be", "is", "are", "was", "were",
]);

const BANNED_EXACT = new Set([
  "strategic context",
  "industry & analyst perspectives",
  "industry and analyst perspectives",
  "financial & macro implications",
  "financial and macro implications",
  "forward outlook",
  "dateline & hook",
  "dateline and hook",
  "key takeaways",
  "looking ahead",
  "conclusion",
  "why it matters",
  "the bottom line",
  "bottom line",
  "what this means",
  "what to watch",
  "background",
  "overview",
  "analysis",
  "implications",
  "market implications",
  "the takeaway",
]);

const BANNED_PREFIXES = [
  "strategic context",
  "forward outlook",
  "industry & analyst",
  "industry and analyst",
  "financial & macro",
  "financial and macro",
];

const VOICE_TICS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bin a move that\b/i, label: "In a move that" },
  { pattern: /\bunderscores?\b/i, label: "underscores" },
  { pattern: /\bnavigating\b/i, label: "navigating" },
  { pattern: /\blandscape\b/i, label: "landscape" },
  { pattern: /\bit remains to be seen\b/i, label: "it remains to be seen" },
  { pattern: /\bgame[- ]changer\b/i, label: "game-changer" },
  { pattern: /\bever[- ]evolving\b/i, label: "ever-evolving" },
  { pattern: /\bcutting[- ]edge\b/i, label: "cutting-edge" },
  { pattern: /\bdelve\b/i, label: "delve" },
  { pattern: /\btapestry\b/i, label: "tapestry" },
  { pattern: /\bpivotal\b/i, label: "pivotal" },
  { pattern: /\bin today'?s\b/i, label: "in today's" },
  { pattern: /\bonly time will tell\b/i, label: "only time will tell" },
  { pattern: /\bone thing is (?:clear|certain)\b/i, label: "one thing is clear" },
  { pattern: /\bmoreover\b/i, label: "moreover" },
  { pattern: /\bnestled\b/i, label: "nestled" },
  { pattern: /\bstands as a testament\b/i, label: "stands as a testament" },
  { pattern: /\brobust\b/i, label: "robust" },
];

const NON_ARTICLE_SLUGS = new Set([
  "tech", "technology", "markets", "leadership", "finance", "business",
  "magazine", "author", "studio", "api", "about", "contact", "search",
  "success-insights", "news", "tag", "category", "privacy", "terms", "sitemap",
]);

const SOURCE_GENERIC = new Set([
  "press", "release", "releases", "news", "wire", "report", "the", "of", "and",
  "media", "online", "com", "www", "local", "test", "fixture",
]);

const STYLE_CRITERIA = [
  "title",
  "slug",
  "headings",
  "plain_voice",
  "source",
  "figures",
  "dates",
  "internal_links",
  "length",
] as const;

type StyleCriterion = (typeof STYLE_CRITERIA)[number];

function collapseSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stylePart(part: string, cap: boolean): string {
  if (!part) return part;
  if (/^(?:[A-Za-z]\.)+[A-Za-z]?\.?$/.test(part)) {
    return part.replace(/[A-Za-z]/g, (letter) => letter.toUpperCase());
  }
  if (/\d/.test(part)) return part;
  const acronym = part.toUpperCase();
  if (ACRONYMS.has(acronym)) return acronym;
  if (/[A-Z]/.test(part.slice(1)) && part[0] === part[0]?.toUpperCase()) return part;
  const lower = part.toLowerCase();
  if (!cap && MINOR_WORDS.has(lower)) return lower;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function styleWord(word: string, cap: boolean): string {
  const match = word.match(/^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$/);
  if (!match) return word;
  const lead = match[1] ?? "";
  const core = match[2] ?? "";
  const tail = match[3] ?? "";
  if (!core) return word;
  const styled = core.includes("-")
    ? core.split("-").map((part, index) => stylePart(part, cap || index > 0)).join("-")
    : stylePart(core, cap);
  return `${lead}${styled}${tail}`;
}

export function toTitleCase(title: string): string {
  const words = collapseSpace(title).split(" ");
  return words
    .map((word, index) => styleWord(word, index === 0 || index === words.length - 1))
    .join(" ");
}

export function isTitleCase(title: string): boolean {
  const collapsed = collapseSpace(title);
  return collapsed.length > 0 && collapsed === toTitleCase(collapsed);
}

export function titleFailures(title: string): string[] {
  const trimmed = collapseSpace(title);
  const failures: string[] = [];
  if (!trimmed) {
    failures.push("title: missing headline");
    return failures;
  }
  if (trimmed.length > TITLE_MAX_CHARS) {
    failures.push(`title: ${trimmed.length} characters (max ${TITLE_MAX_CHARS})`);
  }
  if (!isTitleCase(trimmed)) {
    failures.push("title: must be Title Case");
  }
  return failures;
}

export function keywordSlug(title: string): string {
  const normalized = title.toLowerCase().replace(/[^a-z0-9.%]+/g, " ").trim();
  const words = normalized.split(/\s+/).filter((word) => {
    const bare = word.replace(/\./g, "");
    return bare && !SLUG_STOP.has(bare);
  });
  const picked = (words.length >= 2 ? words : normalized.split(/\s+/).filter(Boolean)).slice(0, 6);
  return sanitizeSlug(picked.join(" "));
}

function contentTokens(slug: string): string[] {
  const tokens = slug.split("-").filter(Boolean);
  const last = tokens[tokens.length - 1] ?? "";
  if (tokens.length > 2 && /^\d{1,2}$/.test(last)) return tokens.slice(0, -1);
  return tokens;
}

export function slugShapeFailures(slug: string, title: string): string[] {
  const failures: string[] = [];
  if (!slug || !isValidPublicSlug(slug)) {
    failures.push("slug: use a short lowercase keyword slug");
    return failures;
  }
  const tokens = contentTokens(slug);
  if (tokens.length < 2 || tokens.length > SLUG_MAX_WORDS) {
    failures.push(
      `slug: use 2 to ${SLUG_MAX_WORDS} keyword words, not the headline (${tokens.length} words)`,
    );
  }
  if (slug.length > SLUG_MAX_CHARS + 4) {
    failures.push(`slug: ${slug.length} characters is a headline, not a short keyword slug`);
  }
  if (tokens.some((token) => token.length === 1 && !/^\d$/.test(token))) {
    failures.push("slug: looks truncated mid-word");
  }
  const titleTokens = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const last = tokens[tokens.length - 1] ?? "";
  const cutMidWord = titleTokens.some(
    (token) => token.startsWith(last) && token.length >= last.length + 2 && last.length >= 3 && last.length <= 6,
  );
  if (cutMidWord && (tokens.length >= 7 || slug.length >= 55)) {
    failures.push("slug: trailing word is a truncated headline token");
  }
  const titleSlug = slugFromTitle(title);
  const bare = tokens.join("-");
  if (bare === titleSlug && titleTokens.length > SLUG_MAX_WORDS) {
    failures.push("slug: repeats the headline; use a few keywords instead");
  }
  return failures;
}

function normalizeHeading(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[:.]+$/g, "");
}

function isBannedHeading(heading: string): boolean {
  const normal = normalizeHeading(heading);
  if (!normal) return false;
  if (BANNED_EXACT.has(normal)) return true;
  return BANNED_PREFIXES.some(
    (prefix) => normal === prefix || normal.startsWith(`${prefix} `) || normal.startsWith(`${prefix}:`),
  );
}

export function extractSubheadings(html: string): string[] {
  const headings: string[] = [];
  for (const match of html.matchAll(/<h[2-4]\b[^>]*>([\s\S]*?)<\/h[2-4]>/gi)) {
    const text = collapseSpace((match[1] ?? "").replace(/<[^>]+>/g, " "));
    if (text) headings.push(text);
  }
  return headings;
}

export function headingFailures(html: string): string[] {
  const headings = extractSubheadings(html);
  const failures: string[] = [];
  const banned = headings.filter((heading) => isBannedHeading(heading));
  if (banned.length) {
    failures.push(
      `headings: template heading "${banned.join('", "')}" is reused across articles; write a story-specific subheading`,
    );
  }
  const specific = headings.filter((heading) => !isBannedHeading(heading));
  if (specific.length < 2) {
    failures.push(`headings: use at least 2 story-specific subheadings (found ${specific.length})`);
  }
  return failures;
}

export function voiceFailures(title: string, html: string): string[] {
  const blob = `${title}\n${html}`;
  const failures: string[] = [];
  if (/—|&mdash;|&#8212;|&#x2014;/i.test(blob) || /\u2014/.test(blob)) {
    failures.push("voice: remove em dashes");
  }
  if (/\u2013|&ndash;|&#8211;|&#x2013;/i.test(blob)) {
    failures.push("voice: remove en dashes used as pauses");
  }
  if (/\s--\s/.test(blob)) {
    failures.push("voice: remove double-hyphen dashes");
  }
  for (const tic of VOICE_TICS) {
    if (tic.pattern.test(blob)) {
      failures.push(`voice: cut the AI tic "${tic.label}"`);
    }
  }
  return failures;
}

function stripSourceFooter(html: string): string {
  return html.replace(/<p>\s*Source:\s*[\s\S]*?<\/p>/gi, " ");
}

export function distinctiveSourceToken(name: string | null): string | null {
  if (!name?.trim()) return null;
  const parts = name.split(/[^A-Za-z0-9&]+/).filter(Boolean);
  const ranked = parts.filter((part) => {
    if (SOURCE_GENERIC.has(part.toLowerCase())) return false;
    return part.length >= 3 || part === part.toUpperCase();
  });
  if (!ranked.length) return name.trim();
  ranked.sort((left, right) => {
    const leftAcronym = left === left.toUpperCase() ? 1 : 0;
    const rightAcronym = right === right.toUpperCase() ? 1 : 0;
    if (leftAcronym !== rightAcronym) return rightAcronym - leftAcronym;
    return right.length - left.length;
  });
  return ranked[0] ?? name.trim();
}

export function sourceAttributionFailures(html: string, notes: LeadNotes): string[] {
  const failures: string[] = [];
  const url = notes.sourceUrl;
  const body = stripSourceFooter(html);
  if (!url) {
    failures.push("source: name and link the source publication in the body");
    return failures;
  }
  if (!sourceHrefInBody(body, url)) {
    failures.push("source: name and link the source publication in the body, not only a trailing Source line");
  }
  const token = distinctiveSourceToken(notes.sourceName);
  if (token) {
    const text = stripTagsForWordCount(body);
    const pattern = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (!pattern.test(text)) {
      failures.push(`source: name the publication (${notes.sourceName}) in the body`);
    }
  }
  return failures;
}

export function inferSourceFromBody(html: string): LeadNotes {
  const pattern = /<a\b[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const url = match[1] ?? "";
    if (/tradeflock/i.test(url)) continue;
    const label = collapseSpace((match[2] ?? "").replace(/<[^>]+>/g, " "));
    if (!label || /^(here|link|source|read more|this report)$/i.test(label)) continue;
    if (label.length > 120) continue;
    return {
      sourceName: label,
      sourceUrl: url,
      publishedAt: null,
      coverUrl: null,
      headline: null,
    };
  }
  return {
    sourceName: null,
    sourceUrl: null,
    publishedAt: null,
    coverUrl: null,
    headline: null,
  };
}

export function extractInternalSlugs(html: string): string[] {
  const slugs = new Set<string>();
  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const href = match[1]?.trim() ?? "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) continue;
    const normalized = toNewsArticleHref(href);
    let pathname = normalized;
    if (/^https?:\/\//i.test(normalized)) {
      try {
        const url = new URL(normalized);
        if (!/tradeflock/i.test(url.hostname)) continue;
        pathname = url.pathname;
      } catch {
        continue;
      }
    }
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length !== 1) continue;
    const slug = (parts[0] ?? "").toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug) || NON_ARTICLE_SLUGS.has(slug)) continue;
    slugs.add(slug);
  }
  return [...slugs];
}

export function internalLinkFailures(
  html: string,
  related: readonly RelatedCandidate[],
): string[] {
  if (related.length === 0) return [];
  const need = Math.min(2, related.length);
  const accepted = new Set(related.map((item) => item.slug.toLowerCase()));
  const found = extractInternalSlugs(html).filter((slug) => accepted.has(slug));
  if (found.length >= need) return [];
  const sample = related
    .slice(0, 4)
    .map((item) => `/${item.slug} (${item.title})`)
    .join("; ");
  return [
    `links: add at least ${need} organic internal TradeFlock links (found ${found.length}). Candidates: ${sample}`,
  ];
}

function criterionFor(failure: string): StyleCriterion | null {
  if (/^title:/i.test(failure)) return "title";
  if (/^slug:/i.test(failure)) return "slug";
  if (/^headings:/i.test(failure) || /formula-empty/i.test(failure)) return "headings";
  if (/^voice:/i.test(failure) || /market-brief/i.test(failure)) return "plain_voice";
  if (/^source:/i.test(failure) || /source URL|source notes are missing|primary source/i.test(failure)) {
    return "source";
  }
  if (/^figures:/i.test(failure) || /observer|allocator/i.test(failure)) return "figures";
  if (/^dates:/i.test(failure) || /^dateline/i.test(failure) || /dateline uses relative/i.test(failure)) {
    return "dates";
  }
  if (/^links:/i.test(failure) || /internal link/i.test(failure)) return "internal_links";
  if (failure.startsWith("too_short")) return "length";
  return null;
}

export function scoreHouseStyle(failures: readonly string[]): number {
  const failed = new Set<StyleCriterion>();
  let unmapped = false;
  for (const failure of failures) {
    const criterion = criterionFor(failure);
    if (criterion) failed.add(criterion);
    else unmapped = true;
  }
  const total = STYLE_CRITERIA.reduce((sum, criterion) => sum + (failed.has(criterion) ? 0 : 10), 0);
  const mean = Math.round((total / STYLE_CRITERIA.length) * 10) / 10;
  if (failed.size === 0 && !unmapped) return mean;
  return Math.min(mean, 7);
}

export type AssessArticleInput = {
  title: string;
  slug: string;
  html: string;
  notes: LeadNotes;
  rawSource: string;
  related: readonly RelatedCandidate[];
  now?: number;
  factCheck?: "full" | "calendar";
};

export function assessWireArticle(input: AssessArticleInput): { failures: string[]; score: number } {
  const all = [
    ...titleFailures(input.title),
    ...slugShapeFailures(input.slug, input.title),
    ...headingFailures(input.html),
    ...voiceFailures(input.title, input.html),
    ...sourceAttributionFailures(input.html, input.notes),
    ...internalLinkFailures(input.html, input.related),
    ...wireHygieneFailures(input.html, input.notes, input.rawSource, input.now ?? Date.now()),
    ...factCheckFailures(
      input.html,
      input.rawSource,
      input.notes,
      input.factCheck ?? "full",
      input.title,
    ),
  ];
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const failure of all) {
    if (seen.has(failure)) continue;
    seen.add(failure);
    failures.push(failure);
  }
  return { failures, score: scoreHouseStyle(failures) };
}
