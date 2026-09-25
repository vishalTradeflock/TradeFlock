import type { LeadNotes } from "@/lib/agents/wire-hygiene";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const SHORT_MONTHS = [
  "Jan.",
  "Feb.",
  "March",
  "April",
  "May",
  "June",
  "July",
  "Aug.",
  "Sept.",
  "Oct.",
  "Nov.",
  "Dec.",
] as const;

const MONTH_INDEX: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const MONTH_PATTERN =
  "September|Sept|January|February|March|April|May|June|July|August|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Oct|Nov|Dec";

const NAME_STOP = new Set([
  "the", "this", "that", "these", "those", "bank", "federal", "national", "reserve",
  "york", "street", "capital", "markets", "market", "office", "department", "ministry",
  "committee", "university", "school", "times", "journal", "post", "review", "report",
  "index", "group", "holdings", "corp", "corporation", "company", "exchange", "board",
  "council", "commission", "senate", "house", "white", "european", "central", "world",
  "international", "monetary", "policy", "chief", "executive", "officer", "press",
  "newswire", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
  "sunday", "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december", "sept", "jan", "feb", "aug", "oct",
  "nov", "dec", "united", "states", "america", "american", "britain", "british",
  "england", "kingdom", "china", "chinese", "japan", "japanese", "europe", "swiss",
  "germany", "german", "france", "french", "india", "indian", "korea", "korean",
  "canada", "canadian", "global", "annual", "small", "business", "forum", "congress",
  "technology", "technologies", "artificial", "intelligence", "open", "prime",
  "minister", "president", "governor", "chairman", "chair", "director", "managing",
  "senior", "vice", "personal", "investing", "wall", "new", "rate", "rates", "price",
  "prices", "stock", "stocks", "bond", "bonds", "debt", "trade", "talks", "chip",
  "chips", "data", "week", "month", "year", "inflation", "interest", "economic",
  "economy", "growth", "energy", "financial", "services", "management", "partners",
  "limited", "association", "authority", "agency", "bureau", "institute", "center",
  "centre", "union", "state", "city", "north", "south", "east", "west", "pacific",
  "london", "washington", "beijing", "shanghai", "tokyo", "paris", "berlin",
  "frankfurt", "hamburg", "geneva", "zurich", "chicago", "boston", "seattle",
  "dallas", "houston", "miami", "atlanta", "denver", "detroit", "dublin", "rome",
  "milan", "madrid", "lisbon", "amsterdam", "brussels", "singapore", "sydney",
  "toronto", "seoul", "taipei", "dubai", "names", "says", "said", "told", "holds",
  "hold", "leaves", "keeps", "kept", "raises", "raised", "cuts", "votes", "vote",
  "rises", "rose", "falls", "fell", "jumps", "climbs", "bans", "launches", "appoints",
  "appointed", "named", "wins", "expands", "completes", "warns", "warning",
  "according", "expected", "after", "before", "from", "with", "into", "about",
  "their", "there", "which", "while", "have", "been", "will", "quarter", "point",
  "points", "basis", "target", "analysts", "analyst", "investors", "investor",
  "shares", "share", "equity", "credit", "yield", "yields", "forecast", "outlook",
  "decision", "statement", "speech", "visit", "deal", "agreement", "plan", "plans",
  "already", "knows", "push", "pushes", "breaks", "break", "fuel", "prices",
  "fed", "feds", "move", "hike", "gilt", "gilts", "print", "dispatch", "hold",
]);

const DATELINE_ALIASES: Record<string, string> = {
  hambourg: "Hamburg",
  allemagne: "Germany",
  londres: "London",
  pekin: "Beijing",
  pékin: "Beijing",
  geneve: "Geneva",
  genève: "Geneva",
  ginebra: "Geneva",
  muenchen: "Munich",
  münchen: "Munich",
  wien: "Vienna",
  roma: "Rome",
  milano: "Milan",
  bruxelles: "Brussels",
  brussel: "Brussels",
  lisboa: "Lisbon",
};

const KNOWN_CITIES = [
  "new york", "san francisco", "los angeles", "fort lauderdale", "hong kong",
  "mexico city", "sao paulo", "buenos aires", "kuala lumpur", "tel aviv",
  "london", "washington", "beijing", "shanghai", "tokyo", "paris", "berlin",
  "frankfurt", "hamburg", "geneva", "zurich", "davos", "munich", "rome",
  "milan", "madrid", "lisbon", "amsterdam", "dublin", "edinburgh", "chicago",
  "boston", "seattle", "austin", "dallas", "houston", "miami", "atlanta",
  "denver", "detroit", "minneapolis", "brussels", "singapore", "sydney",
  "toronto", "ottawa", "seoul", "taipei", "dubai", "riyadh", "warsaw",
  "vienna", "stockholm", "oslo", "copenhagen", "helsinki", "prague",
  "budapest", "luxembourg", "manchester", "birmingham", "glasgow", "cardiff",
  "belfast", "radnor", "mumbai", "delhi", "canberra", "wellington", "kyiv",
  "moscow", "cairo", "johannesburg", "lagos", "santiago", "athens",
];

const FIGURE_PATTERN =
  /(?:\$|£|€)\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s?(?:billion|million|trillion))?|\d{1,3}(?:,\d{3})+(?:\.\d+)?(?:\s?(?:billion|million|trillion))?|\d+(?:\.\d+)?\s?(?:%|percent|percentage points?|basis points?|bps|billion|million|trillion)|\d+\s*-\s*\d+/gi;

export type CalendarDate = {
  year: number;
  month: number;
  day: number;
  weekday: string;
};

export function calendarInNewYork(iso: string): CalendarDate | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date(ms));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const year = Number(read("year"));
  const month = Number(read("month"));
  const day = Number(read("day"));
  const weekday = read("weekday");
  if (!year || !month || !day || !weekday) return null;
  return { year, month, day, weekday };
}

export function weekdayForCalendarDate(year: number, month: number, day: number): string {
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return WEEKDAYS[weekday] ?? "Sunday";
}

export function formatPublishedLine(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const calendar = calendarInNewYork(iso);
  if (!calendar) return null;
  const month = SHORT_MONTHS[calendar.month - 1] ?? "Sept.";
  return `${calendar.weekday}, ${month} ${calendar.day}, ${calendar.year}`;
}

function stripMarkup(value: string, dropHeadings: boolean): string {
  let text = value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  if (dropHeadings) {
    text = text.replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi, " ");
  }
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalFigure(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(\d)\s+percent(?:age points)?/g, "$1%")
    .replace(/percent(?:age points)?/g, "%")
    .replace(/basis points?/g, "bp")
    .replace(/\bbps\b/g, "bp")
    .replace(/\s+/g, "");
}

export function extractFigures(value: string): string[] {
  const text = stripMarkup(value, false);
  const found = new Set<string>();
  for (const match of text.matchAll(FIGURE_PATTERN)) {
    const canonical = canonicalFigure(match[0]);
    if (canonical) found.add(canonical);
  }
  return [...found];
}

export function extractPersonNames(value: string): string[] {
  const text = stripMarkup(value, true);
  const found = new Set<string>();
  const pattern = /\b([A-Z][a-z]+(?:\s+[A-Z]\.)?\s+[A-Z][a-z]+)\b/g;
  for (const match of text.matchAll(pattern)) {
    const name = match[1]?.replace(/\s+/g, " ").trim();
    if (!name) continue;
    const parts = name.split(" ");
    if (parts.some((part) => NAME_STOP.has(part.toLowerCase().replace(/\.$/, "")))) continue;
    found.add(name);
  }
  return [...found];
}

type MentionedDate = {
  month: number;
  day: number;
  year: number | null;
  weekday: string | null;
  label: string;
};

function mentionedDates(value: string): MentionedDate[] {
  const text = value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const pattern = new RegExp(
    `\\b(?:(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\\s+)?(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?`,
    "gi",
  );
  const found: MentionedDate[] = [];
  for (const match of text.matchAll(pattern)) {
    const month = MONTH_INDEX[match[2]?.toLowerCase().replace(/\.$/, "") ?? ""];
    const day = Number(match[3]);
    if (!month || !day || day > 31) continue;
    const year = match[4] ? Number(match[4]) : null;
    found.push({
      month,
      day,
      year: year && year > 1900 ? year : null,
      weekday: match[1] ? match[1].slice(0, 1).toUpperCase() + match[1].slice(1).toLowerCase() : null,
      label: match[0].replace(/\s+/g, " ").trim(),
    });
  }
  return found;
}

function sameMonthDay(left: MentionedDate, right: MentionedDate): boolean {
  if (left.month !== right.month || left.day !== right.day) return false;
  if (left.year && right.year && left.year !== right.year) return false;
  return true;
}

function publishedMention(publishedAt: string | null): MentionedDate | null {
  if (!publishedAt) return null;
  const calendar = calendarInNewYork(publishedAt);
  if (!calendar) return null;
  return {
    month: calendar.month,
    day: calendar.day,
    year: calendar.year,
    weekday: calendar.weekday,
    label: formatPublishedLine(publishedAt) ?? "",
  };
}

function extractDateline(html: string): { city: string; region: string | null } | null {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const match = text.match(
    /^([A-Z][A-Za-zÀ-ÿ.'’-]+(?:\s+[A-Z][A-Za-zÀ-ÿ.'’-]+)?)(?:,\s*([A-Za-zÀ-ÿ.'’-]+))?\s*:/,
  );
  if (!match?.[1]) return null;
  return { city: match[1].trim(), region: match[2]?.replace(/\.$/, "").trim() ?? null };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sourceHasPhrase(source: string, phrase: string): boolean {
  return new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "i").test(source);
}

function englishAlias(token: string): string | null {
  return DATELINE_ALIASES[token.toLowerCase().replace(/\.$/, "")] ?? null;
}

function datelineFailures(html: string, rawSource: string): string[] {
  const dateline = extractDateline(html);
  if (!dateline) return [];
  const failures: string[] = [];
  const cityAlias = englishAlias(dateline.city);
  if (cityAlias) {
    failures.push(
      `dates: dateline "${dateline.city}" should use the English name (${cityAlias})`,
    );
  }
  if (dateline.region) {
    const regionAlias = englishAlias(dateline.region);
    if (regionAlias) {
      failures.push(
        `dates: dateline region "${dateline.region}" should use the English name (${regionAlias})`,
      );
    }
  }
  const city = dateline.city.toLowerCase();
  if (sourceHasPhrase(rawSource, city)) return failures;
  const named = KNOWN_CITIES.filter((place) => sourceHasPhrase(rawSource, place));
  if (named.length && !named.includes(city)) {
    failures.push(
      `dates: dateline ${dateline.city} is not in the source, which names ${named.slice(0, 3).join(", ")}`,
    );
  }
  return failures;
}

function figureFailures(articleText: string, rawSource: string): string[] {
  const allowed = new Set(extractFigures(rawSource));
  const failures: string[] = [];
  for (const figure of extractFigures(articleText)) {
    if (allowed.has(figure)) continue;
    failures.push(`figures: ${figure} is not in the source`);
  }
  return failures;
}

function nameFailures(articleText: string, rawSource: string): string[] {
  const source = stripMarkup(rawSource, false).toLowerCase();
  const failures: string[] = [];
  for (const name of extractPersonNames(articleText)) {
    if (source.includes(name.toLowerCase())) continue;
    failures.push(`figures: name "${name}" is not in the source`);
  }
  return failures;
}

function dateFailures(
  articleText: string,
  rawSource: string,
  publishedAt: string | null,
  mode: "full" | "calendar",
): string[] {
  const published = publishedMention(publishedAt);
  const sourceDates = mentionedDates(rawSource);
  const failures: string[] = [];
  for (const mention of mentionedDates(articleText)) {
    const year = mention.year ?? published?.year ?? null;
    if (mention.weekday && year) {
      const actual = weekdayForCalendarDate(year, mention.month, mention.day);
      if (actual.toLowerCase() !== mention.weekday.toLowerCase()) {
        failures.push(
          `dates: "${mention.label}" does not match the calendar (that date is a ${actual})`,
        );
      }
    }
    if (mode !== "full") continue;
    const supportedByPublish =
      published !== null &&
      mention.month === published.month &&
      mention.day === published.day &&
      (!mention.year || mention.year === published.year);
    const supportedBySource = sourceDates.some((source) => sameMonthDay(mention, source));
    if (!supportedByPublish && !supportedBySource && mention.year) {
      failures.push(`dates: ${mention.label} is not in the source`);
    }
  }
  return failures;
}

export function factCheckFailures(
  html: string,
  rawSource: string,
  notes: Pick<LeadNotes, "publishedAt">,
  mode: "full" | "calendar" = "full",
  title = "",
): string[] {
  const articleText = `${title}\n${html}`;
  const failures = [
    ...dateFailures(articleText, rawSource, notes.publishedAt, mode),
  ];
  if (mode === "calendar") return [...new Set(failures)];
  failures.push(
    ...figureFailures(articleText, rawSource),
    ...nameFailures(articleText, rawSource),
    ...datelineFailures(html, rawSource),
  );
  return [...new Set(failures)];
}

export function formatFactBrief(rawSource: string, publishedAt: string | null): string {
  const line = formatPublishedLine(publishedAt);
  const figures = extractFigures(rawSource).slice(0, 30);
  const names = extractPersonNames(rawSource).slice(0, 20);
  return [
    line
      ? `Use this weekday and date for the source timestamp: ${line}. Do not invent a different weekday.`
      : "Published date: unknown. Do not invent a weekday.",
    figures.length
      ? `Figures in the source (do not add others, and back every comparison with these): ${figures.join(", ")}.`
      : "No figures were parsed from the source. Do not invent numbers, percentages, or sums.",
    names.length
      ? `People named in the source (do not add others): ${names.join(", ")}.`
      : "No people were parsed from the source. Do not invent named executives, analysts, or spokespeople.",
  ].join("\n");
}
