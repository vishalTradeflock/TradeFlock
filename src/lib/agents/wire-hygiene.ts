export type LeadNotes = {
  sourceName: string | null;
  sourceUrl: string | null;
  publishedAt: string | null;
  coverUrl: string | null;
  headline: string | null;
};

const SECTION_TITLES = [
  "Strategic Context",
  "Industry & Analyst Perspectives",
  "Financial & Macro Implications",
  "Forward Outlook",
] as const;

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

export function wireHygieneFailures(
  html: string,
  notes: LeadNotes,
  rawSource: string,
  now = Date.now(),
): string[] {
  const failures: string[] = [];
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

export function writerLeadInstructions(lead: {
  topic: string;
  category: string;
  rawSource: string;
  sourceUrl?: string;
}): string {
  const notes = parseLeadNotes(lead.rawSource);
  const url = lead.sourceUrl ?? notes.sourceUrl ?? "";
  const published = notes.publishedAt ?? "unknown";
  return `Write a 600-to-800-word TradeFlock USA reported-news article (not a market brief) with real <h3> section heads. Omit empty sections.

Topic: ${lead.topic}
Assigned category: ${lead.category}
Primary source URL (must appear as an HTML <a href> in the body): ${url || "(missing — do not invent a URL)"}
Source published timestamp (use this date; do not write Monday/today unless it matches): ${published}

Source notes:
${lead.rawSource}`;
}
