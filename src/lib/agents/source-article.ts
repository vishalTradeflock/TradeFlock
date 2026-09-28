import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { isEnglishCopy } from "./lead-filters.ts";
import { isHttpsCoverUrl } from "../images.ts";
import { isUnusableSourceImageUrl, ogImageFromHtml, SOURCE_FETCH_USER_AGENT } from "../source-photo.ts";

/** Full page fetch budget. Redirects count against the same timer. */
export const SOURCE_ARTICLE_TIMEOUT_MS = 8_000;

/** Stop reading a page after this many bytes so a huge response cannot stall the run. */
export const SOURCE_ARTICLE_MAX_BYTES = 1_500_000;

/**
 * Core news text (boilerplate and the About section excluded) has to be able to
 * support a 550-word reported story. The publish gate stays at 550 words.
 */
export const SOURCE_MIN_WORDS = 450;

/**
 * A short news peg can still run when the source About section tops it up to
 * SOURCE_MIN_WORDS. About is labelled background, never invented copy.
 * Below this, About alone is not a story.
 */
export const SOURCE_TOPUP_CORE_MIN = 180;

/** About 3,000 tokens. Cut from the end, on paragraph boundaries. */
export const SOURCE_TEXT_CHAR_BUDGET = 12_000;

const PAYWALL_RE =
  /subscribe to (?:read|continue)|for subscribers only|subscribers only|sign in to (?:read|continue)|already a subscriber|this (?:article|story|content) is available to subscribers|create an account to continue|you(?:'ve| have) reached your (?:article|free) limit|register to continue/i;

const BLOCK_RE =
  /access denied|attention required|enable javascript and cookies|just a moment\.\.\.|are you a robot|cf-browser-verification|pardon our interruption|\bcaptcha\b|request blocked|403 forbidden/i;

const JUNK_BLOCK =
  /(?:^|[\s_-])(?:related|related-stories|newsletter|share-bar|share-tools|social-share|promo|advertisement|advert|ads|cookie|sidebar|recirc|masthead|paywall|subscribe|outbrain|taboola|recommended|recirculation)(?:[\s_-]|$)/i;

const JUNK_LINE =
  /^(?:advertisement|sponsored|related(?:\s+articles)?|read more|subscribe|sign up|share this|photo:|image:|credit:|watch:|listen:|newsletter|follow us|more from|trending|recommended for you|latest in|most popular|you may also|editor'?s picks)\b/i;

export type SourceSkipReason = "thin" | "blocked" | "fetch_failed" | "non_english";

export type SourceArticleResult =
  | {
      ok: true;
      text: string;
      wordCount: number;
      title: string | null;
      ogImageUrl: string | null;
      finalUrl: string;
    }
  | {
      ok: false;
      reason: SourceSkipReason;
      detail: string;
      wordCount: number;
      /** Extracted copy, when we fetched a page, so a thin lead can be topped up. */
      text?: string;
      title?: string | null;
      ogImageUrl?: string | null;
    };

export function countSourceWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function trimSourceText(text: string, budget = SOURCE_TEXT_CHAR_BUDGET): string {
  const normalized = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (normalized.length <= budget) return normalized;
  const paragraphs = normalized.split(/\n{2,}/);
  let out = "";
  for (const paragraph of paragraphs) {
    const next = out ? `${out}\n\n${paragraph}` : paragraph;
    if (next.length > budget) break;
    out = next;
  }
  return out || normalized.slice(0, budget).trim();
}

const WIRE_DATELINE_RE =
  /,?\s*\/(?:PRNewswire|PR Newswire|Business Wire|GlobeNewswire|ACCESSWIRE|EIN Presswire)\/\s*(?:--|—|–|-)\s*/gi;

const VIEW_ORIGINAL_RE = /^.*\bview original content\b.*$/gim;

const BOILERPLATE_START_RE =
  /^(?:forward[- ]looking statements|safe harbor(?: statement)?|cautionary (?:statement|note)(?: regarding forward[- ]looking statements)?|(?:media|investor|press|ir)\s+(?:contact|contacts|relations)|for media inquiries|source\s+\S)/i;

export type PreparedSourceText = {
  /** News copy. About, safe harbor, contacts, and the SOURCE line are removed. */
  core: string;
  /** About-the-company paragraph, kept as a source fact but not counted toward the gate. */
  background: string;
  /** Core plus a labelled background block, which is what the writer receives. */
  text: string;
  coreWords: number;
  backgroundWords: number;
};

function stripWireChrome(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(VIEW_ORIGINAL_RE, "")
    .replace(WIRE_DATELINE_RE, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** A heading, not the sentence "About 1,200 employees...". */
function isAboutHeading(paragraph: string): boolean {
  const line = paragraph.replace(/\s+/g, " ").trim();
  if (line.length > 80 || /[.!?]$/.test(line)) return false;
  if (/^about\s+\d/i.test(line)) return false;
  return /^about\s+(?:the\s+company|us|[A-Z0-9])/i.test(line);
}

function isBoilerplateStart(paragraph: string): boolean {
  const line = paragraph.replace(/\s+/g, " ").trim();
  return BOILERPLATE_START_RE.test(line);
}

function formatSourceForWriter(core: string, background: string): string {
  const news = core.trim();
  const about = background.trim();
  if (!about) return news;
  return `${news}\n\nCompany background (from the source About section; these are source facts, use them as background, do not invent beyond them):\n${about}`;
}

/**
 * Drop press-release boilerplate before the word count. The About paragraph
 * stays available, clearly labelled, and is not part of `coreWords`.
 */
export function prepareSourceText(raw: string): PreparedSourceText {
  const paragraphs = stripWireChrome(raw)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  let aboutAt = -1;
  let boilerAt = paragraphs.length;
  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index] ?? "";
    if (aboutAt < 0 && isAboutHeading(paragraph)) {
      aboutAt = index;
      continue;
    }
    if (isBoilerplateStart(paragraph)) {
      boilerAt = index;
      break;
    }
  }
  const coreEnd = aboutAt >= 0 ? Math.min(aboutAt, boilerAt) : boilerAt;
  const core = paragraphs.slice(0, coreEnd).join("\n\n");
  const background =
    aboutAt >= 0 && aboutAt < boilerAt ? paragraphs.slice(aboutAt, boilerAt).join("\n\n") : "";
  const backgroundBody = background.replace(/^about\s+[^\n]+/i, "").trim();
  return {
    core,
    background,
    text: formatSourceForWriter(core, background),
    coreWords: countSourceWords(core),
    backgroundWords: countSourceWords(backgroundBody),
  };
}

/** Core is long enough, or a real news peg plus the labelled About section is. */
export function sourceIsSufficient(prepared: PreparedSourceText): boolean {
  if (prepared.coreWords >= SOURCE_MIN_WORDS) return true;
  return (
    prepared.backgroundWords > 0 &&
    prepared.coreWords >= SOURCE_TOPUP_CORE_MIN &&
    prepared.coreWords + prepared.backgroundWords >= SOURCE_MIN_WORDS
  );
}

export function articleSectionText(rawSource: string): string {
  const match = rawSource.match(/\nArticle text\b[^\n]*\n([\s\S]*)$/);
  return match?.[1]?.trim() ?? "";
}

export function mergeSupplementalSource(primary: string, extra: string): string {
  return `${primary.trim()}\n\nAdditional reporting (a second source on the same story; use only these facts and attribute them):\n${extra.trim()}`;
}

export function appendArticleText(rawSource: string, text: string): string {
  const trimmed = trimSourceText(text);
  return `${rawSource.trim()}\n\nArticle text (the source article; report only these facts, attribute and link the publication by name, and do not pad):\n${trimmed}`;
}

type BlockElement = {
  tagName: string;
  textContent: string | null;
  getAttribute(name: string): string | null;
  parentElement: { getAttribute(name: string): string | null } | null;
};

function blockText(node: BlockElement): string | null {
  const hint = `${node.getAttribute("class") ?? ""} ${node.parentElement?.getAttribute("class") ?? ""} ${node.getAttribute("id") ?? ""}`;
  if (JUNK_BLOCK.test(hint)) return null;
  const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
  if (!text || JUNK_LINE.test(text)) return null;
  const heading = /^h[23]$/i.test(node.tagName);
  if (heading) return text.length >= 8 ? text : null;
  if (text.length < 40 && !/\d/.test(text)) return null;
  if (text.length < 20) return null;
  return text;
}

function blocksFromRoot(root: { querySelectorAll(selector: string): Iterable<BlockElement> }): string[] {
  const lines: string[] = [];
  for (const node of root.querySelectorAll("p, h2, h3, li")) {
    const text = blockText(node);
    if (!text) continue;
    if (lines[lines.length - 1] === text) continue;
    lines.push(text);
  }
  return lines;
}

function stripChrome(document: {
  querySelector(selector: string): { closest?(selector: string): unknown } | null;
  querySelectorAll(selector: string): Iterable<{
    remove(): void;
    closest?(selector: string): unknown;
    getAttribute(name: string): string | null;
  }>;
}) {
  for (const node of document.querySelectorAll("script, style, noscript, iframe, svg, form, button")) {
    node.remove();
  }
  for (const node of document.querySelectorAll("nav, footer, header, aside")) {
    if (node.closest?.("article")) continue;
    node.remove();
  }
  for (const node of document.querySelectorAll(
    "[role=navigation], [role=banner], [role=contentinfo]",
  )) {
    node.remove();
  }
  for (const node of document.querySelectorAll("div, section, aside, ul, ol")) {
    const hint = `${node.getAttribute("class") ?? ""} ${node.getAttribute("id") ?? ""}`;
    if (JUNK_BLOCK.test(hint)) node.remove();
  }
}

function heuristicText(html: string): string {
  const { document } = parseHTML(html);
  stripChrome(document);
  const root =
    document.querySelector("article") ??
    document.querySelector("main") ??
    document.querySelector("[itemprop='articleBody']") ??
    document.body;
  if (!root) return "";
  return blocksFromRoot(root).join("\n\n");
}

function readabilityText(html: string, pageUrl: string): { title: string | null; text: string } | null {
  try {
    const { document } = parseHTML(html);
    const head = document.querySelector("head");
    if (head) {
      const base = document.createElement("base");
      base.setAttribute("href", pageUrl);
      head.appendChild(base);
    }
    const parsed = new Readability(document as unknown as Document, { charThreshold: 120 }).parse();
    if (!parsed?.content) return null;
    const { document: fragment } = parseHTML(`<!DOCTYPE html><html><body>${parsed.content}</body></html>`);
    const text = blocksFromRoot(fragment.body).join("\n\n");
    return { title: parsed.title?.trim() || null, text };
  } catch {
    return null;
  }
}

export function extractSourceArticle(html: string, pageUrl: string): {
  title: string | null;
  text: string;
  wordCount: number;
  ogImageUrl: string | null;
} {
  const fromReader = readabilityText(html, pageUrl);
  const fromHeuristic = heuristicText(html);
  const readableWords = countSourceWords(fromReader?.text ?? "");
  const heuristicWords = countSourceWords(fromHeuristic);
  const text =
    readableWords >= 80 || readableWords >= heuristicWords
      ? (fromReader?.text ?? fromHeuristic)
      : fromHeuristic || fromReader?.text || "";
  const rawOg = ogImageFromHtml(html, pageUrl);
  const ogImageUrl =
    rawOg && isHttpsCoverUrl(rawOg) && !isUnusableSourceImageUrl(rawOg) ? rawOg : null;
  return {
    title: fromReader?.title ?? null,
    text,
    wordCount: countSourceWords(text),
    ogImageUrl,
  };
}

export function isBlockedSourceText(text: string, html: string): boolean {
  if (PAYWALL_RE.test(text) || BLOCK_RE.test(text)) return true;
  // Challenge pages often have almost no article text; the marker sits in the shell.
  return BLOCK_RE.test(html.slice(0, 2_500));
}

export function classifyExtractedSource(input: {
  status: number;
  wordCount: number;
  text: string;
  html: string;
  contentType?: string | null;
}): "ready" | "thin" | "blocked" {
  const type = input.contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (type && !/^(text\/html|application\/xhtml\+xml)$/.test(type)) return "blocked";
  if (input.status === 401 || input.status === 403 || input.status === 404 || input.status === 410 || input.status === 451) {
    return "blocked";
  }
  if (input.wordCount < SOURCE_MIN_WORDS && isBlockedSourceText(input.text, input.html)) return "blocked";
  if (input.wordCount < SOURCE_MIN_WORDS) return "thin";
  return "ready";
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function readTextCapped(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    return text.length > maxBytes ? text.slice(0, maxBytes) : text;
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (received < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      const room = maxBytes - received;
      if (value.byteLength > room) {
        chunks.push(value.slice(0, room));
        received += room;
        break;
      }
      chunks.push(value);
      received += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

function fetchFailureDetail(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "TimeoutError" || err.name === "AbortError") return "timed out";
    return err.message || "fetch failed";
  }
  return "fetch failed";
}

export async function fetchSourceArticle(
  pageUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SourceArticleResult> {
  let parsed: URL;
  try {
    parsed = new URL(pageUrl);
  } catch {
    return { ok: false, reason: "blocked", detail: "invalid source url", wordCount: 0 };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "blocked", detail: "source url must be https", wordCount: 0 };
  }

  let response: Response;
  try {
    response = await fetchImpl(pageUrl, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(SOURCE_ARTICLE_TIMEOUT_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": SOURCE_FETCH_USER_AGENT,
      },
    });
  } catch (err) {
    return { ok: false, reason: "fetch_failed", detail: fetchFailureDetail(err), wordCount: 0 };
  }

  if (isTransientStatus(response.status)) {
    return { ok: false, reason: "fetch_failed", detail: `HTTP ${response.status}`, wordCount: 0 };
  }
  if (!response.ok) {
    return { ok: false, reason: "blocked", detail: `HTTP ${response.status}`, wordCount: 0 };
  }

  const contentType = response.headers.get("content-type");
  const html = await readTextCapped(response, SOURCE_ARTICLE_MAX_BYTES);
  const finalUrl = response.url || pageUrl;
  const extracted = extractSourceArticle(html, finalUrl);
  const prepared = prepareSourceText(extracted.text);
  const kind = classifyExtractedSource({
    status: response.status,
    wordCount: prepared.coreWords,
    text: prepared.core || extracted.text,
    html,
    contentType,
  });
  if (kind === "blocked") {
    const why = contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)
      ? `unsupported content-type ${contentType.split(";")[0]?.trim()}`
      : `paywall or block page (${prepared.coreWords} words)`;
    return {
      ok: false,
      reason: "blocked",
      detail: why,
      wordCount: prepared.coreWords,
      text: prepared.text,
      title: extracted.title,
      ogImageUrl: extracted.ogImageUrl,
    };
  }
  const languageSample = `${extracted.title ?? ""}\n${prepared.core}`;
  if (prepared.coreWords >= 40 && !isEnglishCopy(languageSample)) {
    return {
      ok: false,
      reason: "non_english",
      detail: "source article is not English",
      wordCount: prepared.coreWords,
      text: prepared.text,
      title: extracted.title,
      ogImageUrl: extracted.ogImageUrl,
    };
  }
  if (!sourceIsSufficient(prepared)) {
    return {
      ok: false,
      reason: "thin",
      detail: `${prepared.coreWords} words of core source text (need ≥${SOURCE_MIN_WORDS}; background ${prepared.backgroundWords} words, not counted unless it tops the story up)`,
      wordCount: prepared.coreWords,
      text: prepared.text,
      title: extracted.title,
      ogImageUrl: extracted.ogImageUrl,
    };
  }
  return {
    ok: true,
    text: prepared.text,
    wordCount: countSourceWords(prepared.text),
    title: extracted.title,
    ogImageUrl: extracted.ogImageUrl,
    finalUrl,
  };
}

export type SourceCandidate = {
  topic: string;
  rawSource: string;
  sourceUrl?: string | null;
  /** Another English item on the same story, fetched only when the primary page is thin. */
  supplementUrl?: string | null;
};

export type WritableSourceLead<T> = T & {
  rawSource: string;
  sourceOgImageUrl: string | null;
  sourcePageFetched: true;
};

export type SkippedSourceLead<T> = {
  lead: T;
  reason: SourceSkipReason;
  detail: string;
  /** Fingerprint the lead so a later run does not retry a page that will not grow. */
  persist: boolean;
};

export type SourceSelection<T> = {
  leads: WritableSourceLead<T>[];
  skipped: SkippedSourceLead<T>[];
  deferred: T[];
  stopped: "limit" | "pool" | "time";
  stats: { fetched: number; skippedThin: number; skippedBlocked: number; skippedNonEnglish: number };
};

function countsAsFetched(result: SourceArticleResult): boolean {
  return result.ok || result.reason === "thin" || result.reason === "non_english" || result.wordCount > 0;
}

async function topUpThinLead(
  lead: SourceCandidate,
  result: Extract<SourceArticleResult, { ok: false }>,
  fetchArticle: (url: string) => Promise<SourceArticleResult>,
  budgetOk: () => boolean,
  onFetched: (extra: SourceArticleResult) => void,
): Promise<SourceArticleResult> {
  const supplement = lead.supplementUrl?.trim() ?? "";
  const primaryText = result.text?.trim() ?? "";
  if (!supplement || supplement === (lead.sourceUrl?.trim() ?? "") || !primaryText || !budgetOk()) {
    return result;
  }
  let extra: SourceArticleResult;
  try {
    extra = await fetchArticle(supplement);
  } catch {
    return result;
  }
  onFetched(extra);
  if (!extra.ok && extra.reason === "non_english") return result;
  const extraText = extra.text?.trim() ?? "";
  if (!extraText) return result;
  if (!extra.ok && extra.reason !== "thin") return result;
  const merged = mergeSupplementalSource(primaryText, extraText);
  if (countSourceWords(merged) < SOURCE_MIN_WORDS) return result;
  return {
    ok: true,
    text: merged,
    wordCount: countSourceWords(merged),
    title: result.title ?? extra.title ?? null,
    ogImageUrl: result.ogImageUrl ?? extra.ogImageUrl ?? null,
    finalUrl: supplement,
  };
}

/**
 * Walk a larger candidate pool until `limit` leads have a full enough source
 * article. Thin and blocked pages are skipped before any model call.
 */
export async function selectWritableLeads<T extends SourceCandidate>(
  leads: readonly T[],
  options: {
    limit: number;
    fetchArticle?: (url: string) => Promise<SourceArticleResult>;
    timeRemainingMs?: () => number;
    minBudgetMs?: number;
    concurrency?: number;
  },
): Promise<SourceSelection<T>> {
  const limit = Math.max(1, options.limit);
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, leads.length || 1));
  const minBudgetMs = options.minBudgetMs ?? 60_000;
  const timeRemainingMs = options.timeRemainingMs ?? (() => Number.POSITIVE_INFINITY);
  const fetchArticle = options.fetchArticle ?? ((url: string) => fetchSourceArticle(url));

  const slots: Array<WritableSourceLead<T> | undefined> = new Array(leads.length);
  const skipped: SkippedSourceLead<T>[] = [];
  const stats = { fetched: 0, skippedThin: 0, skippedBlocked: 0, skippedNonEnglish: 0 };
  let nextIndex = 0;
  let readyCount = 0;
  let stoppedForTime = false;

  async function worker() {
    for (;;) {
      if (stoppedForTime || readyCount >= limit) return;
      if (timeRemainingMs() < minBudgetMs) {
        stoppedForTime = true;
        return;
      }
      const index = nextIndex;
      nextIndex += 1;
      if (index >= leads.length) return;
      const lead = leads[index];
      if (!lead) return;

      const url = lead.sourceUrl?.trim() ?? "";
      if (!url) {
        stats.skippedBlocked += 1;
        skipped.push({
          lead,
          reason: "blocked",
          detail: "missing source url",
          persist: true,
        });
        continue;
      }

      let result: SourceArticleResult;
      try {
        result = await fetchArticle(url);
      } catch (err) {
        result = {
          ok: false,
          reason: "fetch_failed",
          detail: err instanceof Error ? err.message || "fetch failed" : "fetch failed",
          wordCount: 0,
        };
      }
      if (countsAsFetched(result)) stats.fetched += 1;
      if (!result.ok && result.reason === "thin") {
        result = await topUpThinLead(
          lead,
          result,
          fetchArticle,
          () => timeRemainingMs() >= minBudgetMs,
          (extra) => {
            if (countsAsFetched(extra)) stats.fetched += 1;
          },
        );
      }
      if (result.ok) {
        if (readyCount < limit) {
          readyCount += 1;
          slots[index] = {
            ...lead,
            rawSource: appendArticleText(lead.rawSource, result.text),
            sourceOgImageUrl: result.ogImageUrl,
            sourcePageFetched: true,
          };
        }
        continue;
      }
      if (result.reason === "non_english") {
        stats.skippedNonEnglish += 1;
        skipped.push({ lead, reason: "non_english", detail: result.detail, persist: true });
        continue;
      }
      if (result.reason === "thin") {
        stats.skippedThin += 1;
        skipped.push({ lead, reason: "thin", detail: result.detail, persist: true });
        continue;
      }
      stats.skippedBlocked += 1;
      skipped.push({
        lead,
        reason: result.reason,
        detail: result.detail,
        persist: result.reason !== "fetch_failed",
      });
    }
  }

  if (leads.length > 0) {
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
  }

  const chosen = slots.filter((lead): lead is WritableSourceLead<T> => Boolean(lead)).slice(0, limit);
  const deferred = leads.slice(nextIndex);
  const stopped = chosen.length >= limit ? "limit" : stoppedForTime ? "time" : "pool";
  return { leads: chosen, skipped, deferred, stopped, stats };
}
