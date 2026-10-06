import { foldDiacritics } from "./lead-filters.ts";

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

/**
 * Everyday news words. A title-case pair is a person or company only when at
 * least one token is outside this list ("Jane Doe", "Cathay Capital").
 * Pairs such as "Use Airlines" or "Task Force" are not names.
 */
const ORDINARY_TITLE_WORDS = new Set(
  `a an the and but or nor for on at to from by of in with as vs via over into amid after before during
  under within without across among around since until because although however still just only even more
  most less many much some any each every other another such same own per its his her she him our your they
  them this that these those what when where who whom whose how why than then also not so if can may might
  must will would could should have has had been being be do does did done say says said tell tells told
  according expected already new next first last big small high low major top best open public private
  national global local world home early late long short near far above below out up down off back
  use uses used using hit hits face faces faced staff cloud foundation action task force yet
  airlines airline air flight flights market markets price prices stock stocks share shares bond bonds
  rate rates bank banks fund funds group groups company companies business businesses industry industries
  sector growth profit profits revenue sales sale cost costs deal deals plan plans risk risks data week
  weeks month months year years today yesterday tomorrow report reports survey surveys index number numbers
  total average record records demand supply outlook forecast guidance quarter earnings margin margins
  debt equity credit loan loans capital management partner partners system systems platform platforms
  network networks security digital online retail consumer consumers store stores brand brands chain chains
  club clubs portfolio
  factory plant plants product products service services software technology team teams people worker workers
  employee employees customer customers union government policy trade energy power oil gas fuel diesel
  inflation economy labor jobs job wage wages payroll clinic clinics hospital patient patients doctor care
  health healthcare medical holiday cheer pet pets shelter award awards campaign campaigns landmark landmarks
  orange glow bullying prevention expansion opening openings launch launches research study studies paper
  bill law rule rules court case cases suit trial fine fines fee fees tax taxes budget spending hike hikes
  gain gains loss losses drop drops rise rises fall falls jump jumps surge slump rally crisis shock blow
  boost push pull shift change changes trend trends view views look take takes stake stakes role roles
  post posts seat seats vote votes election leader leaders member members panel committee board council
  agency bureau department ministry office authority commission association institute university school
  college center centre program programme project projects effort efforts move moves step steps call calls
  warning alert made make makes work works run runs lead leads leave leaves stay stays remain remains
  become becomes include includes follow follows expect expects continue continues announce announces
  announced unveil unveils unveiled introduce introduces introduced release releases released issue issues
  issued file files filed sue sues buy buys sell sells pay pays grow grows build builds close closes closed
  sign signs signed agree agrees agreed pass passes fail fails miss misses beat beats slow slows join joins
  joined weigh weighs spark sparks fuel fuels drive drives mark marks exit exits resign resigns earn earns
  earned invite invites invited support supports enter enters entered meet meets deliver delivers develop
  develops developed debut debuts celebrate celebrates spread spreads help helps need needs want wants
  get gets got give gives find finds found show shows showed start starts end ends add adds added keep keeps
  kept hold holds held cut cuts raise raises raised name names named win wins expand expands expanded
  complete completes seek seeks offer offers see sees set sets move warn warns warned ban bans appoint
  appoints appointed report plan seek strategic context analyst analysts perspectives financial macro
  implications forward outlook dateline hook source press release news wire media online chief executive
  officer president director directors governor chairman chair managing senior vice personal investing wall
  street journal times review annual small forum congress technology technologies artificial intelligence
  prime minister white house european central international monetary federal reserve united states america
  american britain british england kingdom china chinese japan japanese europe european swiss germany german
  france french india indian korea korean canada canadian global north south east west pacific london
  washington beijing shanghai tokyo paris berlin frankfurt hamburg geneva zurich chicago boston seattle
  dallas houston miami atlanta denver detroit dublin rome milan madrid lisbon amsterdam brussels singapore
  sydney toronto seoul taipei dubai new york san francisco los angeles hong kong mexico city fort lauderdale
  sao paulo buenos aires kuala lumpur tel aviv monday tuesday wednesday thursday friday saturday sunday
  january february march april may june july august september october november december sept jan feb aug oct
  nov dec mad money chorus growing record told saying added including inc corp corporation llc ltd plc co
  company limited holdings holding group incorporated systems solution solutions based across about
  investors investor shares equity yield yields decision statement speech visit agreement already knows
  observers observer experts expert unnamed familiar matter industry legislative market participants
  exchange securities formation regulation regulatory agenda commissioners commissioner notice session
  topics recommendations recommendation participants officials entrepreneurs webcast remarks accredited
  investor definition eligibility regardless float exempt offering updates proposals cited consider item
  document forecast volumes comments relevant video archives transcript discussions posted materials facts
  watch statutory clock started mailing headquarters private sector smaller public companies founders
  empowering supporting innovation considerations early stage growth stage capital raising crowdfunding
  form cap caps million billion trillion percent percentage point points basis target analysts analyst
  quarter point chip chips week month year inflation interest economic economy energy financial services
  management partners limited association authority agency bureau institute center centre union state city
  names says said told holds hold leaves keeps kept raises raised cuts votes vote rises rose falls fell
  jumps climbs bans launches appoints appointed named wins expands completes warns warning according
  expected after before from with into about their there which while have been will quarter
  cloud native task force inner circle farm profit recognition award awards honored honored honour
  clinic dermatology staff faces face airlines airline use uses hit hits why yet than action
  san francisco angeles paulo aires lumpur aviv lauderdale minneapolis edinburgh canberra wellington
  johannesburg santiago athens riyadh warsaw vienna stockholm oslo copenhagen helsinki prague budapest
  luxembourg manchester birmingham glasgow cardiff belfast mumbai delhi kyiv moscow cairo lagos
  radnor austin ottawa sao hong kong fort tel`.split(/\s+/).filter(Boolean),
);

/** Place phrases that are not a person, even though neither word is generic news English. */
const ORDINARY_TITLE_PHRASES = new Set(["silicon valley"]);

const OWN_SECTION_SLUGS = new Set([
  "tech",
  "technology",
  "markets",
  "leadership",
  "finance",
  "business",
  "magazine",
  "author",
  "studio",
  "api",
  "about",
  "contact",
  "search",
  "success-insights",
  "news",
  "tag",
  "category",
  "privacy",
  "terms",
  "sitemap",
  "media",
  "brand",
  "og",
]);

function isOwnStoryHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#") || /^mailto:/i.test(trimmed)) return false;
  let pathname = trimmed.split("#")[0]?.split("?")[0] ?? "";
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (!/tradeflock/i.test(url.hostname)) return false;
      pathname = url.pathname;
    } catch {
      return false;
    }
  } else if (!pathname.startsWith("/")) {
    return false;
  }
  const parts = pathname.split("/").filter(Boolean).map((part) => {
    try {
      return decodeURIComponent(part).toLowerCase();
    } catch {
      return part.toLowerCase();
    }
  });
  if (parts.length === 2 && parts[0] === "news") return /^[a-z0-9][a-z0-9-]*$/.test(parts[1] ?? "");
  if (parts.length !== 1) return false;
  const slug = parts[0] ?? "";
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return false;
  return !OWN_SECTION_SLUGS.has(slug);
}

/** Story titles inside our own links are not invented people. */
function stripOwnStoryAnchors(html: string): string {
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (full, attrs: string) => {
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] ?? "";
    return isOwnStoryHref(href) ? " " : full;
  });
}

function nameScanText(value: string): string {
  return stripOwnStoryAnchors(value)
    .replace(/<p>\s*Source:\s*[\s\S]*?<\/p>/gi, " ")
    .replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function isOrdinaryTitleToken(token: string): boolean {
  const bare = foldDiacritics(token).toLowerCase().replace(/\.$/, "");
  return ORDINARY_TITLE_WORDS.has(bare);
}

function isOrdinaryTitlePhrase(name: string): boolean {
  return ORDINARY_TITLE_PHRASES.has(foldDiacritics(name).toLowerCase().replace(/\s+/g, " ").trim());
}

function sourceHasToken(foldedSource: string, token: string): boolean {
  const folded = foldDiacritics(token).toLowerCase().replace(/\.$/, "");
  if (!folded) return true;
  return new RegExp(`\\b${escapeRegExp(folded)}\\b`, "i").test(foldedSource);
}

/**
 * Two-word title case is not automatically a proper name. Generic phrases are
 * ignored. A remaining name is unsourced only when a distinctive token is
 * absent from the notes — the two-word span itself is often not in the source
 * even when the person or company is ("Benioff Told").
 */
export function unsourcedNameFailures(html: string, rawSource: string): string[] {
  const text = nameScanText(html);
  const source = foldDiacritics(nameScanText(rawSource)).toLowerCase();
  const failures: string[] = [];
  const seen = new Set<string>();
  const pattern = /\b([A-Z][a-z]+(?:\s+[A-Z]\.)?\s+[A-Z][a-z]+)\b/g;
  let match: RegExpExecArray | null;
  let previous = -1;

  while ((match = pattern.exec(text))) {
    const index = match.index ?? 0;
    if (index <= previous) break;
    previous = index;
    // Step one character so "Benioff Told Cramer" also checks "Told Cramer".
    pattern.lastIndex = index + 1;
    const name = match[1]?.replace(/\s+/g, " ").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    if (isOrdinaryTitlePhrase(name)) continue;
    const tokens = name.split(" ").filter((part) => !/^[A-Z]\.$/.test(part));
    const distinctive = tokens.filter((token) => !isOrdinaryTitleToken(token));
    if (distinctive.length === 0) continue;
    const missing = distinctive.some((token) => !sourceHasToken(source, token));
    if (!missing) continue;
    failures.push(`names not in the source: "${name}"`);
  }
  return failures;
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
  const hasArticle = /\nArticle text\b/.test(`\n${lead.rawSource}`);
  const sourceRule = hasArticle
    ? "The Article text section is the full source. Use every newsworthy fact, figure, attributed quote, and company-background line in it. Attribute quotes. Attribute and link the source publication by name in a sentence. When the guidance supplies TradeFlock internal-link candidates, use them. Do not pad, and do not add background, quotes, figures, or people the article does not contain."
    : "Use every newsworthy fact, figure, and attributed quote written in the source notes. Attribute and link the source publication by name. When the guidance supplies TradeFlock internal-link candidates, use them. Do not pad.";
  return `Write a 650-to-850-word TradeFlock USA reported-news article (not a market brief, not a digest) with story-specific <h3> section heads. Never use the template headings Strategic Context, Industry & Analyst Perspectives, Financial & Macro Implications, or Forward Outlook. The piece must be at least 550 words and at least 5 substantial paragraphs. 650 to 850 words is the target. Use the source fully. Do not stub, do not pad, and do not stop short of the facts the source supports.

${sourceRule}

Headline: Title Case, at most 60 characters. No em dashes.

Topic: ${lead.topic}
Assigned category: ${lead.category}
Primary source URL (must appear as an HTML <a href> in the body, and the publication name must appear in that sentence): ${url || "(missing; do not invent a URL)"}
Source published timestamp (use this date and its real weekday; do not write Monday/today unless it matches): ${published}
${extra}
Source notes:
${lead.rawSource}`;
}

/** Paragraphs whose distinctive words are mostly absent from the draft. */
export function unusedSourceParagraphs(sourceText: string, draft: string): string {
  const draftFolded = foldDiacritics(stripTagsForWordCount(draft)).toLowerCase();
  const unused: string[] = [];
  for (const paragraph of sourceText.split(/\n{2,}/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    if (/^(?:company background|additional reporting)\b/i.test(trimmed)) continue;
    const words = foldDiacritics(trimmed).toLowerCase().match(/[a-z]{5,}/g) ?? [];
    if (words.length < 6) continue;
    let hits = 0;
    for (const word of words) {
      if (draftFolded.includes(word)) hits += 1;
    }
    if (hits / words.length < 0.4) unused.push(trimmed);
  }
  return unused.join("\n\n");
}
