import { formatFactBrief } from "@/lib/agents/fact-check";
import { assessWireArticle, keywordSlug, slugShapeFailures, toTitleCase } from "@/lib/agents/house-style";
import {
  EDITOR_IN_CHIEF_PROMPT,
  EXPAND_PROMPT,
  PUBLISH_SCORE_MIN,
  REPAIR_PROMPT,
  WRITER_PROMPTS,
  resolveWriterDesk,
  type WriterDesk,
} from "@/lib/agents/prompts";
import {
  formatRelatedCandidates,
  loadRelatedCandidates,
  type RelatedCandidate,
} from "@/lib/agents/related-articles";
import { sanitizeCoverUrl } from "@/lib/images";
import { loadUsedCoverKeys } from "@/lib/cover-picker";
import { allocateArticleSlug, sanitizeSlug } from "@/lib/studio/slug";
import { sanitizeArticleBody } from "@/lib/sanitize-article-body";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { completeLlmChat, isLlmQuotaError } from "@/lib/llm";
import { editorialDek, holdPublishedAt, withHoldNote } from "@/lib/agents/hold-copy";
import { leadPublishedSkipReason } from "@/lib/agents/lead-filters";
import { resolveUniquePublishCover } from "@/lib/agents/source-cover";
import { articleSectionText, countSourceWords, SOURCE_MIN_WORDS } from "@/lib/agents/source-article";
import {
  parseLeadNotes,
  polishWireBody,
  unsourcedNameFailures,
  writerLeadInstructions,
  isTooShortFailure,
  unusedSourceParagraphs,
  countBodyWords,
  type LeadNotes,
} from "@/lib/agents/wire-hygiene";

export type NewsLead = {
  topic: string;
  rawSource: string;
  category: string;
  sourceUrl?: string;
  imageUrl?: string | null;
  /** og:image from the source page already fetched for the article text. */
  sourceOgImageUrl?: string | null;
  /** True when the wire downloaded the source page, even if it had no og:image. */
  sourcePageFetched?: boolean;
  /** Second English source on the same story, used when the primary page is thin. */
  supplementUrl?: string | null;
};

export type EditorVerdict = {
  approved: boolean;
  score: number;
  editedTitle: string;
  editedSlug: string;
  editedContent: string;
  excerpt: string;
};

export type WordCounts = {
  source: number;
  writer: number;
  editor: number;
  final: number;
};

export type PipelineResult =
  | {
      published: true;
      slug: string;
      title: string;
      score: number;
      desk: WriterDesk;
      wordCounts?: WordCounts;
    }
  | {
      published: false;
      score: number;
      desk: WriterDesk;
      reason: string;
      title?: string;
      verdict?: EditorVerdict;
      wordCounts?: WordCounts;
    };

export type ProcessLeadOptions = {
  minScore?: number;
  requireApproved?: boolean;
};


/**
 * Writer output must fit a 650–850 word HTML article. Gemini thinking tokens
 * count against max_tokens; a "length" finish is retried once higher in llm.ts.
 */
const WRITER_MAX_TOKENS = 8192;

/** Below this, the model body is a failed generation, not a draft to save. */
export const MIN_GENERATION_WORDS = 150;
const EDITOR_MAX_TOKENS = 8192;
const REPAIR_MAX_TOKENS = 8192;

const SITE_CATEGORY: Record<WriterDesk, string> = {
  tech: "tech",
  markets: "markets",
  ma: "finance",
  strategy: "leadership",
  macro: "markets",
  retail: "finance",
};

// Desk bylines: the original desk correspondents (restored at Vishal's request).
const DESK_AUTHOR: Record<WriterDesk, string> = {
  tech: "james-whitaker",
  markets: "elena-vasquez",
  ma: "sophia-brennan",
  strategy: "marcus-chen",
  macro: "elena-vasquez",
  retail: "priya-nair",
};

function isEditorVerdict(value: unknown): value is EditorVerdict {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.approved === "boolean" &&
    typeof record.score === "number" &&
    typeof record.editedTitle === "string" &&
    typeof record.editedContent === "string" &&
    typeof record.excerpt === "string"
  );
}

function isUnusableEditorPayload(err: unknown): boolean {
  const message = err instanceof Error ? err.message : "";
  return (
    err instanceof SyntaxError ||
    /invalid JSON payload|Unterminated string|Unexpected token|empty completion/i.test(message)
  );
}

function parseEditorVerdict(raw: string): EditorVerdict {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const parsed: unknown = JSON.parse(stripped);
  if (!isEditorVerdict(parsed)) {
    throw new Error("Editor agent returned an invalid JSON payload");
  }
  const slug = "editedSlug" in parsed && typeof parsed.editedSlug === "string" ? parsed.editedSlug : "";
  return { ...parsed, editedSlug: slug };
}

async function uniquePublishSlug(
  admin: ReturnType<typeof createAdminClient>,
  preferred: string,
  title: string,
) {
  const base = sanitizeSlug(preferred) || keywordSlug(title) || title;
  return allocateArticleSlug(base, base, async (slug) => {
    const { data } = await admin.from("articles").select("id").eq("slug", slug).maybeSingle();
    return Boolean(data?.id);
  });
}

function toHtmlBody(content: string) {
  if (content.includes("<p>") || content.includes("<h3>")) return content;
  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("\n");
}

function writerGuidance(lead: NewsLead, related: readonly RelatedCandidate[]): string {
  const notes = parseLeadNotes(lead.rawSource);
  return `${formatFactBrief(lead.rawSource, notes.publishedAt)}\n${formatRelatedCandidates(related)}`;
}

function normalizeVerdict(verdict: EditorVerdict): EditorVerdict {
  const editedTitle = toTitleCase(verdict.editedTitle).trim();
  const provided = sanitizeSlug(verdict.editedSlug || "");
  const fallback = keywordSlug(editedTitle);
  const editedSlug =
    provided && slugShapeFailures(provided, editedTitle).length === 0
      ? provided
      : fallback || provided;
  return {
    ...verdict,
    editedTitle,
    editedSlug,
    excerpt: verdict.excerpt.trim().slice(0, 280),
  };
}

async function draftFromWriter(desk: WriterDesk, lead: NewsLead, guidance: string) {
  try {
    return await completeLlmChat({
      system: WRITER_PROMPTS[desk],
      temperature: 0.45,
      maxTokens: WRITER_MAX_TOKENS,
      user: writerLeadInstructions(lead, guidance),
    });
  } catch (err) {
    if (isLlmQuotaError(err)) throw err;
    // An empty model body is a failed generation, not a draft. The caller retries once.
    if (err instanceof Error && /empty completion/i.test(err.message)) return "";
    throw err;
  }
}

function editorUser(desk: WriterDesk, lead: NewsLead, draft: string, guidance: string) {
  const notes = parseLeadNotes(lead.rawSource);
  const sourceUrl = lead.sourceUrl ?? notes.sourceUrl ?? "";
  return `Desk: ${desk}
Topic: ${lead.topic}
Category: ${lead.category}
Primary source URL (must remain an HTML <a href> in editedContent, with the publication name in that sentence): ${sourceUrl || "(missing; do not invent a URL)"}
Source published timestamp (weekday and date must match the guidance): ${notes.publishedAt ?? "unknown"}

${guidance}

Source notes:
${lead.rawSource}

Draft:
${draft}`;
}

async function editWithEditor(desk: WriterDesk, lead: NewsLead, draft: string, guidance: string) {
  const raw = await completeLlmChat({
    system: EDITOR_IN_CHIEF_PROMPT,
    temperature: 0.2,
    json: true,
    maxTokens: EDITOR_MAX_TOKENS,
    user: editorUser(desk, lead, draft, guidance),
  });

  return parseEditorVerdict(raw);
}

async function repairWithEditor(
  desk: WriterDesk,
  lead: NewsLead,
  verdict: EditorVerdict,
  failures: readonly string[],
  guidance: string,
) {
  const raw = await completeLlmChat({
    system: REPAIR_PROMPT,
    temperature: 0.2,
    json: true,
    maxTokens: REPAIR_MAX_TOKENS,
    user: `${editorUser(desk, lead, verdict.editedContent, guidance)}

Current title: ${verdict.editedTitle}
Current slug: ${verdict.editedSlug}

Failures to fix (every one must be gone; do not add new facts):
${failures.map((failure) => `- ${failure}`).join("\n")}`,
  });
  return parseEditorVerdict(raw);
}

async function expandWithEditor(
  desk: WriterDesk,
  lead: NewsLead,
  verdict: EditorVerdict,
  failures: readonly string[],
  guidance: string,
) {
  const unused = unusedSourceParagraphs(articleSectionText(lead.rawSource), verdict.editedContent);
  const raw = await completeLlmChat({
    system: EXPAND_PROMPT,
    temperature: 0.2,
    json: true,
    maxTokens: EDITOR_MAX_TOKENS,
    user: `${editorUser(desk, lead, verdict.editedContent, guidance)}

Current title: ${verdict.editedTitle}
Current slug: ${verdict.editedSlug}

Unused source paragraphs (integrate these facts; do not add anything else):
${unused || "(none parsed; restore sourced facts from the notes that the draft dropped, and do not invent)"}

Failures to fix while you expand (do not add new facts):
${failures.map((failure) => `- ${failure}`).join("\n")}`,
  });
  return parseEditorVerdict(raw);
}

function isFactCheckFailure(failure: string): boolean {
  return failure.startsWith("figures:") || failure.startsWith("dates:");
}

function leadSourceWords(lead: NewsLead): number {
  return countSourceWords(articleSectionText(lead.rawSource));
}

type ArticleInsert = Pick<
  Database["public"]["Tables"]["articles"]["Insert"],
  | "slug"
  | "title"
  | "dek"
  | "excerpt"
  | "body"
  | "cover_image_url"
  | "cover_image_alt"
  | "category_id"
  | "author_id"
  | "is_featured"
  | "is_breaking"
  | "view_count"
  | "status"
  | "published_at"
>;

function categoryKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function resolveCategoryId(
  admin: ReturnType<typeof createAdminClient>,
  desk: WriterDesk,
  leadCategory: string,
) {
  const { data: categories, error } = await admin
    .from("categories")
    .select("id, slug, name");

  if (error || !categories?.length) {
    throw new Error(`Unable to load categories: ${error?.message ?? "empty table"}`);
  }

  const wanted = [
    categoryKey(leadCategory),
    SITE_CATEGORY[desk],
  ].filter((slug, index, all) => slug && all.indexOf(slug) === index);

  for (const slug of wanted) {
    const bySlug = categories.find((row) => row.slug === slug);
    if (bySlug) return bySlug.id;
  }

  const leadName = leadCategory.trim().toLowerCase();
  const byName = categories.find((row) => row.name.trim().toLowerCase() === leadName);
  if (byName) return byName.id;

  throw new Error(
    `No matching categories.id for lead "${leadCategory}" (desk ${desk}). Known: ${categories
      .map((row) => row.slug)
      .join(", ")}`,
  );
}

async function resolveAuthorId(
  admin: ReturnType<typeof createAdminClient>,
  desk: WriterDesk,
) {
  const { data: author, error } = await admin
    .from("authors")
    .select("id")
    .eq("slug", DESK_AUTHOR[desk])
    .maybeSingle();

  if (error || !author) {
    throw new Error(`Missing desk author "${DESK_AUTHOR[desk]}"`);
  }
  return author.id;
}

function leadNotes(lead: NewsLead): LeadNotes {
  const notes = parseLeadNotes(lead.rawSource);
  return {
    ...notes,
    sourceUrl: lead.sourceUrl ?? notes.sourceUrl,
    coverUrl: sanitizeCoverUrl(lead.imageUrl) ?? sanitizeCoverUrl(notes.coverUrl),
  };
}

function prepareWireBody(
  lead: NewsLead,
  title: string,
  slug: string,
  content: string,
  coverImageUrl: string,
  related: readonly RelatedCandidate[],
) {
  const notes = leadNotes(lead);
  const sanitized = sanitizeArticleBody(toHtmlBody(content), {
    title,
    coverImageUrl,
  });
  const body = polishWireBody(sanitized, notes);
  const assessment = assessWireArticle({
    title,
    slug,
    html: body,
    notes,
    rawSource: lead.rawSource,
    related,
    factCheck: "full",
  });
  const failures = mergeNameHolds(assessment.failures, body, lead.rawSource);
  return { body, notes, failures, score: assessment.score };
}

/**
 * The house-style gate already reports these via fact-check. Keep any name
 * hold the gate did not already quote, so a two-word span still blocks publish.
 */
function mergeNameHolds(failures: string[], html: string, rawSource: string): string[] {
  const extra = unsourcedNameFailures(html, rawSource).filter((failure) => {
    const quoted = /"([^"]+)"/.exec(failure)?.[1];
    if (!quoted) return true;
    return !failures.some((item) => item.includes(quoted));
  });
  return extra.length ? [...failures, ...extra] : failures;
}

async function commitVerdict(
  lead: NewsLead,
  desk: WriterDesk,
  verdict: EditorVerdict,
  related: readonly RelatedCandidate[],
): Promise<PipelineResult> {
  const admin = createAdminClient();
  const title = verdict.editedTitle.trim();
  const slug = await uniquePublishSlug(admin, verdict.editedSlug, title);
  const notes = leadNotes(lead);
  const [categoryId, authorId, usedCovers] = await Promise.all([
    resolveCategoryId(admin, desk, lead.category),
    resolveAuthorId(admin, desk),
    loadUsedCoverKeys(admin),
  ]);
  const pickCover = async (used: Set<string>) =>
    (
      await resolveUniquePublishCover({
        imageUrl: lead.imageUrl,
        notesCoverUrl: notes.coverUrl,
        sourceUrl: notes.sourceUrl,
        title,
        categorySlug: SITE_CATEGORY[desk],
        used,
        ogAlreadyFetched: lead.sourcePageFetched === true,
        prefetchedOgImageUrl: lead.sourceOgImageUrl ?? null,
      })
    ).url;
  const coverImageUrl = await pickCover(usedCovers);
  const prepared = prepareWireBody(lead, title, slug, verdict.editedContent, coverImageUrl, related);
  if (prepared.failures.length) {
    const held = holdForHygiene(desk, verdict, prepared.body, prepared.failures, prepared.score);
    await trySaveHeldDraft(lead, desk, verdict, prepared.body, prepared.failures);
    return held;
  }

  // Phase 1: the wire never publishes. Even in WIRE_MODE=publish the approved
  // copy is saved as a draft for the owning desk; it can only go live after a
  // reporting packet and a Wire Editor PUBLISH verdict (DB editorial gate).
  void categoryId;
  void authorId;
  void coverImageUrl;
  const reason = "Wire copy saved as draft only: needs a reporting packet and a Wire Editor PUBLISH verdict.";
  await trySaveHeldDraft(lead, desk, verdict, prepared.body, [reason]);
  return {
    published: false,
    score: prepared.score,
    desk,
    title,
    reason,
    verdict: { ...verdict, approved: false, editedContent: prepared.body },
  };
}

async function trySaveHeldDraft(
  lead: NewsLead,
  desk: WriterDesk,
  verdict: EditorVerdict,
  body: string,
  failures: string[],
) {
  try {
    const admin = createAdminClient();
    const title = verdict.editedTitle.trim() || lead.topic.trim() || "Held draft";
    const slug = await uniquePublishSlug(admin, verdict.editedSlug, title);
    const [categoryId, authorId] = await Promise.all([
      resolveCategoryId(admin, desk, lead.category),
      resolveAuthorId(admin, desk),
    ]);
    const reason = holdReason(failures);
    const excerpt = editorialDek(verdict.excerpt, body, title);
    console.warn(`[pipeline] held "${title}": ${reason}`);
    const insert: ArticleInsert = {
      slug,
      title,
      dek: excerpt,
      excerpt,
      body: withHoldNote(body, reason),
      // No stock stand-in: a cover is picked (uniquely) only when it publishes.
      cover_image_url: "",
      cover_image_alt: title,
      category_id: categoryId,
      author_id: authorId,
      is_featured: false,
      is_breaking: false,
      view_count: 0,
      status: "draft",
      // Intentional hide marker: public queries keep published_at <= now.
      // Studio resets this to now when the draft is published.
      published_at: holdPublishedAt(),
    };
    const written = await admin.from("articles").insert(insert).select("slug").single();
    if (written.error) {
      console.error(`[pipeline] held draft not saved: ${written.error.message}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "held draft failed";
    console.error(`[pipeline] held draft not saved: ${message}`);
  }
}

function holdReason(failures: string[]): string {
  const short = failures.find(isTooShortFailure);
  if (short) {
    const detail = short.replace(/^too_short — /, "");
    const others = failures.filter((item) => item !== short);
    if (others.length === 0) return `Held — ${detail}.`;
    return `Held — ${detail}. Also: ${others.join("; ")}.`;
  }
  return `Held as draft. House style: ${failures.join("; ")}.`;
}

function holdForHygiene(
  desk: WriterDesk,
  verdict: EditorVerdict,
  body: string,
  failures: string[],
  score = Math.min(verdict.score, 7),
): Extract<PipelineResult, { published: false }> {
  const capped = Math.min(score, 7);
  return {
    published: false,
    score: capped,
    desk,
    title: verdict.editedTitle,
    reason: holdReason(failures),
    verdict: {
      ...verdict,
      approved: false,
      score: capped,
      editedContent: body,
    },
  };
}

function emptyGeneration(
  desk: WriterDesk,
  lead: NewsLead,
  wordCounts: WordCounts,
): Extract<PipelineResult, { published: false }> {
  console.error(
    `[pipeline] skip empty generation "${lead.topic}": source=${wordCounts.source} writer=${wordCounts.writer} editor=${wordCounts.editor}`,
  );
  return {
    published: false,
    score: 0,
    desk,
    title: lead.topic,
    reason: `empty_generation — model body was ${Math.max(wordCounts.writer, wordCounts.editor)} words`,
    wordCounts,
  };
}

async function editOrFallback(
  desk: WriterDesk,
  lead: NewsLead,
  draft: string,
  guidance: string,
): Promise<EditorVerdict> {
  try {
    return normalizeVerdict(await editWithEditor(desk, lead, draft, guidance));
  } catch (err) {
    if (isLlmQuotaError(err)) throw err;
    if (!isUnusableEditorPayload(err)) throw err;
    return normalizeVerdict({
      approved: false,
      score: 0,
      editedTitle: lead.topic,
      editedSlug: "",
      editedContent: draft,
      excerpt: "",
    });
  }
}

export async function processNewsLead(
  lead: NewsLead,
  options: ProcessLeadOptions = {},
): Promise<PipelineResult> {
  const desk = resolveWriterDesk(lead.category);
  const stale = leadPublishedSkipReason(parseLeadNotes(lead.rawSource).publishedAt);
  if (stale) {
    console.warn(`[pipeline] skip "${lead.topic}": ${stale}`);
    return {
      published: false,
      score: 0,
      desk,
      reason: `Skipped — ${stale}.`,
    };
  }
  const minScore = options.minScore ?? PUBLISH_SCORE_MIN;
  const requireApproved = options.requireApproved ?? true;
  const related = await loadRelatedCandidates({ topic: lead.topic, category: lead.category });
  const guidance = writerGuidance(lead, related);
  const source = leadSourceWords(lead);

  let draft = await draftFromWriter(desk, lead, guidance);
  let writer = countBodyWords(draft);
  if (writer < MIN_GENERATION_WORDS) {
    console.warn(`[pipeline] writer body ${writer} words; retrying once "${lead.topic}"`);
    draft = await draftFromWriter(desk, lead, guidance);
    writer = countBodyWords(draft);
  }
  if (writer < MIN_GENERATION_WORDS) {
    return emptyGeneration(desk, lead, { source, writer, editor: 0, final: 0 });
  }

  let verdict = await editOrFallback(desk, lead, draft, guidance);
  let editor = countBodyWords(verdict.editedContent);
  if (editor < MIN_GENERATION_WORDS) {
    console.warn(`[pipeline] editor body ${editor} words; retrying writer once "${lead.topic}"`);
    draft = await draftFromWriter(desk, lead, guidance);
    writer = countBodyWords(draft);
    if (writer < MIN_GENERATION_WORDS) {
      return emptyGeneration(desk, lead, { source, writer, editor, final: 0 });
    }
    verdict = await editOrFallback(desk, lead, draft, guidance);
    editor = countBodyWords(verdict.editedContent);
  }
  if (editor < MIN_GENERATION_WORDS) {
    return emptyGeneration(desk, lead, { source, writer, editor, final: 0 });
  }

  let prepared = prepareWireBody(
    lead,
    verdict.editedTitle,
    verdict.editedSlug,
    verdict.editedContent,
    "",
    related,
  );

  if (prepared.failures.length) {
    const shortIsMajor =
      prepared.failures.some(isTooShortFailure) &&
      !prepared.failures.some(isFactCheckFailure) &&
      source >= SOURCE_MIN_WORDS;
    try {
      if (shortIsMajor) {
        verdict = normalizeVerdict(
          await expandWithEditor(desk, lead, verdict, prepared.failures, guidance),
        );
        prepared = prepareWireBody(
          lead,
          verdict.editedTitle,
          verdict.editedSlug,
          verdict.editedContent,
          "",
          related,
        );
        if (prepared.failures.length > 0 && !prepared.failures.some(isTooShortFailure)) {
          verdict = normalizeVerdict(
            await repairWithEditor(desk, lead, verdict, prepared.failures, guidance),
          );
          prepared = prepareWireBody(
            lead,
            verdict.editedTitle,
            verdict.editedSlug,
            verdict.editedContent,
            "",
            related,
          );
        }
      } else {
        verdict = normalizeVerdict(
          await repairWithEditor(desk, lead, verdict, prepared.failures, guidance),
        );
        prepared = prepareWireBody(
          lead,
          verdict.editedTitle,
          verdict.editedSlug,
          verdict.editedContent,
          "",
          related,
        );
      }
    } catch (err) {
      if (isLlmQuotaError(err)) throw err;
    }
  }

  editor = countBodyWords(verdict.editedContent);
  if (editor < MIN_GENERATION_WORDS) {
    return emptyGeneration(desk, lead, { source, writer, editor, final: 0 });
  }

  verdict = { ...verdict, editedContent: prepared.body, score: prepared.score, approved: prepared.failures.length === 0 };
  const wordCounts: WordCounts = {
    source,
    writer,
    editor,
    final: countBodyWords(prepared.body),
  };
  console.log(
    `[pipeline] words source=${wordCounts.source} writer=${wordCounts.writer} editor=${wordCounts.editor} final=${wordCounts.final} "${lead.topic}"`,
  );
  const belowBar =
    prepared.failures.length > 0 ||
    prepared.score < minScore ||
    (requireApproved && !verdict.approved);

  if (belowBar) {
    await trySaveHeldDraft(lead, desk, verdict, prepared.body, prepared.failures);
    return { ...holdForHygiene(desk, verdict, prepared.body, prepared.failures, prepared.score), wordCounts };
  }

  return { ...(await commitVerdict(lead, desk, verdict, related)), wordCounts };
}
