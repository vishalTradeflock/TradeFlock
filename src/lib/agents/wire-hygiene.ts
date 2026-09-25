export type LeadNotes = {
  sourceName: string | null;
  sourceUrl: string | null;
  publishedAt: string | null;
  coverUrl: string | null;
  headline: string | null;
};

/** Hard publish floor: strip HTML, then count words. Stubs and briefing-length copy are held. */
export const ARTICLE_MIN_WORDS = 550;

/** Publishable copy is a reported article, not 2–3 skinny grafs. */
export const ARTICLE_MIN_PARAGRAPHS = 5;

const SUBSTANTIAL_PARAGRAPH_MIN_WORDS = 30;
const FORMULA_SECTION_MIN_WORDS = 20;

const SECTION_TITLES = [
  "Strategic Context",
  "Industry & Analyst Perspectives",
  "Financial & Macro Implications",
  "Forward Outlook",
] as const;

const FORMULA_SECTIONS = ["Strategic Context", "Forward Outlook"] as const;

const EMPTY_ANALYST_RE =
  /did not cite|no analysts?|unnamed analysts?|industry observers|legislative observers|market participants and legislative observers await/i;

const INVENTED_VOICE_RE =
  /\b(?:industry observers|legislative observers|experts say|people familiar with the matter)\b/i;

const ALLOCATOR_SPECULATION_RE =
  /return on investment timelines|sales cycles? for .{0,40}could lengthen|temporarily compress software margins|margin pressures against the capital expenditure/i;

const MARKET_BRIEF_RE =
  /aligning .{0,80} with a growing caution|runaway deployment risks/i;

const LEAD_RELATIVE_DATE_RE =
  /\b(?:released|published|filed|announced|issued|delivered)\b[^.<]{0,80}\b(?:today|yesterday|this week|(?:on\s+)?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))\b/i;

const RELATIVE_NOUN_RE =
  /\b(?:today|yesterday|this week|(?:on\s+)?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))(?:'s)?\s+(?:release|report|filing|announcement)\b/i;

export function stripTagsForWordCount(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countBodyWords(html: string): number {
  const text = stripTagsForWordCount(html);
  if (!text) return 0;
  return text.split(" ").filter(Boolean).length;
}

export function countSubstantialParagraphs(html: string): number {
  const blocks = html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) ?? [];
  return blocks.filter((block) => {
    const text = stripTagsForWordCount(block);
    if (!text || /^source:/i.test(text)) return false;
    return text.split(" ").filter(Boolean).length >= SUBSTANTIAL_PARAGRAPH_MIN_WORDS;
  }).length;
}

export function tooShortFailureMessage(wordCount: number): string {
  return `too_short — below Forbes length bar (~${wordCount} words, need ≥${ARTICLE_MIN_WORDS})`;
}

export function isTooShortFailure(failure: string): boolean {
  return failure.startsWith("too_short");
}

function decodeAmpEntities(value: string) {
  let decoded = value.trim();
  for (let i = 0; i < 5; i += 1) {
    const next = decoded.replace(/&amp;/gi, "&");
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

function firstLine(raw: string, label: string): string | null {
  const match = raw.match(new RegExp(`^${label}:\\s*(.+)$`, "im"));
  const value = match?.[1]?.trim();
  return value || null;
}

export function parseLeadNotes(rawSource: string): LeadNotes {
  const sourceUrl = firstLine(rawSource, "URL");
  const coverLine = firstLine(rawSource, "Cover");
  const coverToken = coverLine ? decodeAmpEntities(coverLine.split(/\s/)[0] ?? "") : "";
  return {
    sourceName: firstLine(rawSource, "Source"),
    sourceUrl: sourceUrl && /^https?:\/\//i.test(sourceUrl) ? sourceUrl.split(/\s/)[0] : null,
    publishedAt: firstLine(rawSource, "Published"),
    coverUrl: coverToken && /^https?:\/\//i.test(coverToken) ? coverToken : null,
    headline: firstLine(rawSource, "Headline"),
  };
}

export function sourceHrefInBody(html: string, sourceUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return false;
  }
  const haystack = html.toLowerCase();
  if (haystack.includes(sourceUrl.toLowerCase())) return true;
  const hostPath = `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname}`.toLowerCase().replace(/\/$/, "");
  if (hostPath.length >= 12 && haystack.includes(hostPath)) return true;
  return false;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titlePattern(title: string) {
  return escapeRegExp(title).replace(/&/g, "&(?:amp;)?");
}

export function normalizeWireHeadings(html: string): string {
  let out = html;
  for (const title of SECTION_TITLES) {
    const pattern = titlePattern(title);
    out = out.replace(
      new RegExp(`(?:^|\\n)##\\s*${pattern}\\s*(?=\\n|<|$)`, "gi"),
      `\n<h3>${title}</h3>`,
    );
    out = out.replace(
      new RegExp(`<h[12][^>]*>\\s*${pattern}\\s*</h[12]>`, "gi"),
      `<h3>${title}</h3>`,
    );
    out = out.replace(
      new RegExp(
        `<p>\\s*(?:<(?:strong|b)>)\\s*${pattern}\\s*(?:</(?:strong|b)>)\\s*</p>`,
        "gi",
      ),
      `<h3>${title}</h3>`,
    );
  }
  return out;
}

function splitSections(html: string): { heading: string | null; html: string }[] {
  const parts = html.split(/(<h3\b[^>]*>[\s\S]*?<\/h3>)/i);
  const sections: { heading: string | null; html: string }[] = [];
  let current: { heading: string | null; html: string } = { heading: null, html: "" };

  for (const part of parts) {
    const heading = part.match(/^<h3\b[^>]*>([\s\S]*?)<\/h3>$/i);
    if (heading) {
      if (current.heading !== null || current.html.trim()) sections.push(current);
      current = { heading: heading[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), html: part };
      continue;
    }
    current.html += part;
  }
  if (current.heading !== null || current.html.trim()) sections.push(current);
  return sections;
}

export function collapseEmptyWireSections(html: string): string {
  return splitSections(html)
    .filter((section) => {
      if (!section.heading) return true;
      if (!/industry\s*(?:&|and)\s*analyst/i.test(section.heading)) return true;
      const body = section.html.replace(/<h3\b[^>]*>[\s\S]*?<\/h3>/i, "");
      const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!text) return false;
      const words = text.split(" ").filter(Boolean).length;
      return !(EMPTY_ANALYST_RE.test(text) || words < 40);
    })
    .map((section) => section.html)
    .join("");
}

function sourceLinkLabel(notes: LeadNotes) {
  const name = notes.sourceName?.trim() || "Source";
  const headline = notes.headline?.trim();
  return headline ? `${name}: ${headline}` : name;
}

export function ensureSourceLink(html: string, notes: LeadNotes): string {
  const url = notes.sourceUrl;
  if (!url) return html;
  if (sourceHrefInBody(html, url)) return html;
  const label = sourceLinkLabel(notes);
  const line = `<p>Source: <a href="${url}">${label}</a>.</p>`;
  return `${html.trim()}\n${line}`;
}

export function polishWireBody(html: string, notes: LeadNotes): string {
  let out = normalizeWireHeadings(html);
  out = collapseEmptyWireSections(out);
  out = ensureSourceLink(out, notes);
  return out.trim();
}

function calendarHint(publishedAt: string): string | null {
  const ms = Date.parse(publishedAt);
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  const month = date.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  const short = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = String(date.getUTCDate());
  const year = String(date.getUTCFullYear());
  return `${month} ${day}|${short} ${day}|${month} ${day}, ${year}|${short}.? ${day},? ${year}|${year}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function hasDishonestRelativeDate(
  html: string,
  publishedAt: string | null,
  rawSource: string,
  now = Date.now(),
): boolean {
  if (!publishedAt) return false;
  const ms = Date.parse(publishedAt);
  if (!Number.isFinite(ms)) return false;
  const ageHours = (now - ms) / 36e5;
  if (ageHours < 48) return false;

  const text = html.replace(/<[^>]+>/g, " ");
  const hit = text.match(LEAD_RELATIVE_DATE_RE) ?? text.match(RELATIVE_NOUN_RE);
  if (!hit) return false;

  const notes = rawSource.toLowerCase();
  if (notes.includes(hit[0].toLowerCase())) return false;

  const hint = calendarHint(publishedAt);
  if (hint) {
    const windowStart = Math.max(0, (hit.index ?? 0) - 70);
    const nearby = text.slice(windowStart, windowStart + hit[0].length + 140);
    if (new RegExp(hint, "i").test(nearby)) return false;
  }
  return true;
}

function usedWithoutNotes(html: string, rawSource: string, pattern: RegExp): boolean {
  const match = html.match(pattern);
  if (!match) return false;
  return !rawSource.toLowerCase().includes(match[0].toLowerCase());
}

function sectionBodyWordCount(section: { heading: string | null; html: string }): number {
  const body = section.html
    .replace(/<h3\b[^>]*>[\s\S]*?<\/h3>/i, "")
    .replace(/<p>\s*Source:[\s\S]*?<\/p>/gi, "");
  return countBodyWords(body);
}

function formulaEmptySectionTitles(html: string): string[] {
  const sections = splitSections(html);
  const empty: string[] = [];
  for (const title of FORMULA_SECTIONS) {
    const section = sections.find(
      (item) => item.heading && new RegExp(`^${titlePattern(title)}$`, "i").test(item.heading),
    );
    if (!section) continue;
    if (sectionBodyWordCount(section) < FORMULA_SECTION_MIN_WORDS) {
      empty.push(title);
    }
  }
  return empty;
}

export function wireHygieneFailures(
  html: string,
  notes: LeadNotes,
  rawSource: string,
  now = Date.now(),
): string[] {
  const failures: string[] = [];
  const wordCount = countBodyWords(html);
  const paragraphs = countSubstantialParagraphs(html);
  if (wordCount < ARTICLE_MIN_WORDS) {
    failures.push(tooShortFailureMessage(wordCount));
  } else if (paragraphs < ARTICLE_MIN_PARAGRAPHS) {
    failures.push(
      `too_short — briefing/digest structure (${paragraphs} substantial paragraphs, need ≥${ARTICLE_MIN_PARAGRAPHS})`,
    );
  }
  const formulaEmpty = formulaEmptySectionTitles(html);
  if (formulaEmpty.length) {
    failures.push(
      `formula-empty ${formulaEmpty.join(" / ")} (heading with no facts)`,
    );
  }
  if (!notes.sourceUrl) {
    failures.push("source notes are missing a primary URL");
  } else if (!sourceHrefInBody(html, notes.sourceUrl)) {
    failures.push("body is missing an HTML link to the primary source URL");
  }
  if (hasDishonestRelativeDate(html, notes.publishedAt, rawSource, now)) {
    failures.push("dateline uses relative weekday urgency that does not match the source Published date");
  }
  if (usedWithoutNotes(html, rawSource, INVENTED_VOICE_RE)) {
    failures.push("invented observers/experts not present in the source notes");
  }
  if (usedWithoutNotes(html, rawSource, ALLOCATOR_SPECULATION_RE)) {
    failures.push("unsupported allocator or margin speculation");
  }
  if (MARKET_BRIEF_RE.test(html)) {
    failures.push("synthetic market-brief voice");
  }
  return failures;
}

export function writerLeadInstructions(
  lead: {
    topic: string;
    category: string;
    rawSource: string;
    sourceUrl?: string;
  },
  guidance = "",
): string {
  const notes = parseLeadNotes(lead.rawSource);
  const url = lead.sourceUrl ?? notes.sourceUrl ?? "";
  const published = notes.publishedAt ?? "unknown";
  const extra = guidance.trim() ? `\n${guidance.trim()}\n` : "";
  return `Write a 600-to-800-word TradeFlock USA reported-news article (not a market brief, not a digest) with story-specific <h3> section heads. Never use the template headings Strategic Context, Industry & Analyst Perspectives, Financial & Macro Implications, or Forward Outlook. Under ~550 words, or only 2 to 3 skinny sections, is a hard fail and will be held. If these notes cannot support that length with attributed facts, do not stub or pad. The desk will HOLD the lead.

Headline: Title Case, at most 60 characters. No em dashes.

Topic: ${lead.topic}
Assigned category: ${lead.category}
Primary source URL (must appear as an HTML <a href> in the body, and the publication name must appear in that sentence): ${url || "(missing; do not invent a URL)"}
Source published timestamp (use this date and its real weekday; do not write Monday/today unless it matches): ${published}
${extra}
Source notes:
${lead.rawSource}`;
}
