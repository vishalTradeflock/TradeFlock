import { revalidatePath } from "next/cache";
import { formatFactBrief } from "@/lib/agents/fact-check";
import { assessWireArticle, keywordSlug, slugShapeFailures, toTitleCase } from "@/lib/agents/house-style";
import {
  EDITOR_IN_CHIEF_PROMPT,
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
import { FALLBACK_COVER_IMAGE, sanitizeCoverUrl } from "@/lib/images";
import { allocateArticleSlug, sanitizeSlug } from "@/lib/studio/slug";
import { sanitizeArticleBody } from "@/lib/sanitize-article-body";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { completeLlmChat, isLlmQuotaError } from "@/lib/llm";
import { resolvePublishCoverUrl } from "@/lib/agents/source-cover";
import {
  parseLeadNotes,
  polishWireBody,
  writerLeadInstructions,
  isTooShortFailure,
  type LeadNotes,
} from "@/lib/agents/wire-hygiene";

export type NewsLead = {
  topic: string;
  rawSource: string;
  category: string;
  sourceUrl?: string;
  imageUrl?: string | null;
};

export type EditorVerdict = {
  approved: boolean;
  score: number;
  editedTitle: string;
  editedSlug: string;
  editedContent: string;
  excerpt: string;
};

export type PipelineResult =
  | {
      published: true;
      slug: string;
      title: string;
      score: number;
      desk: WriterDesk;
    }
  | {
      published: false;
      score: number;
      desk: WriterDesk;
      reason: string;
      title?: string;
      verdict?: EditorVerdict;
    };

export type ProcessLeadOptions = {
  minScore?: number;
  requireApproved?: boolean;
};

/** Floor for ?force=1. Hygiene (source link, dating, invented observers, market-brief voice, length) still blocks publish. */
export const FORCE_PUBLISH_SCORE_MIN = 6;

/** Writer output must fit a 600–800 word HTML article; 2048 truncates. EiC and repair JSON stay at 8192. */
const WRITER_MAX_TOKENS = 4096;
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
  return completeLlmChat({
    system: WRITER_PROMPTS[desk],
    temperature: 0.45,
    maxTokens: WRITER_MAX_TOKENS,
    user: writerLeadInstructions(lead, guidance),
  });
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

function toArticleRow(input: {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category_id: string;
  author_id: string;
  cover_image_url: string;
}): ArticleInsert {
  return {
    slug: input.slug,
    title: input.title,
    dek: input.excerpt,
    excerpt: input.excerpt,
    body: input.body,
    cover_image_url: input.cover_image_url,
    cover_image_alt: input.title,
    category_id: input.category_id,
    author_id: input.author_id,
    is_featured: false,
    is_breaking: false,
    view_count: 0,
    status: "published",
    published_at: new Date().toISOString(),
  };
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
  return { body, notes, failures: assessment.failures, score: assessment.score };
}

async function publishArticle(insert: ArticleInsert) {
  const admin = createAdminClient();
  const withStatus = await admin.from("articles").insert(insert).select("slug").single();

  if (!withStatus.error) {
    return withStatus.data.slug;
  }

  const statusUnknown =
    withStatus.error.message.includes("status") ||
    withStatus.error.message.includes("schema cache");

  if (!statusUnknown) {
    throw new Error(withStatus.error.message);
  }

  const { status, ...withoutStatus } = insert;
  void status;
  const fallback = await admin.from("articles").insert(withoutStatus).select("slug").single();
  if (fallback.error) {
    throw new Error(fallback.error.message);
  }
  return fallback.data.slug;
}

async function commitVerdict(
  lead: NewsLead,
  desk: WriterDesk,
  verdict: EditorVerdict,
  related: readonly RelatedCandidate[],
): Promise<PipelineResult> {
  const admin = createAdminClient();
  const title = verdict.editedTitle.trim();
  const excerpt = verdict.excerpt.trim().slice(0, 280);
  const slug = await uniquePublishSlug(admin, verdict.editedSlug, title);
  const notes = leadNotes(lead);
  const [categoryId, authorId, coverImageUrl] = await Promise.all([
    resolveCategoryId(admin, desk, lead.category),
    resolveAuthorId(admin, desk),
    resolvePublishCoverUrl({
      imageUrl: lead.imageUrl,
      notesCoverUrl: notes.coverUrl,
      sourceUrl: notes.sourceUrl,
      article: {
        id: slug,
        title,
        slug,
        category: { slug: SITE_CATEGORY[desk] },
      },
    }),
  ]);
  const prepared = prepareWireBody(lead, title, slug, verdict.editedContent, coverImageUrl, related);
  if (prepared.failures.length) {
    const held = holdForHygiene(desk, verdict, prepared.body, prepared.failures, prepared.score);
    await trySaveHeldDraft(lead, desk, verdict, prepared.body, prepared.failures);
    return held;
  }

  await publishArticle(
    toArticleRow({
      slug,
      title,
      excerpt,
      body: prepared.body,
      category_id: categoryId,
      author_id: authorId,
      cover_image_url: coverImageUrl,
    }),
  );

  revalidatePath("/");
  revalidatePath(`/${slug}`);
  revalidatePath("/[slug]", "page");
  revalidatePath("/success-insights");

  return {
    published: true,
    slug,
    title,
    score: prepared.score,
    desk,
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
    const excerpt = failures.join("; ").slice(0, 280) || title;
    const insert: ArticleInsert = {
      slug,
      title,
      dek: excerpt,
      excerpt,
      body,
      cover_image_url: FALLBACK_COVER_IMAGE,
      cover_image_alt: title,
      category_id: categoryId,
      author_id: authorId,
      is_featured: false,
      is_breaking: false,
      view_count: 0,
      status: "draft",
      published_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
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

export async function processNewsLead(
  lead: NewsLead,
  options: ProcessLeadOptions = {},
): Promise<PipelineResult> {
  const desk = resolveWriterDesk(lead.category);
  const minScore = options.minScore ?? PUBLISH_SCORE_MIN;
  const requireApproved = options.requireApproved ?? true;
  const related = await loadRelatedCandidates({ topic: lead.topic, category: lead.category });
  const guidance = writerGuidance(lead, related);
  const draft = await draftFromWriter(desk, lead, guidance);

  let verdict: EditorVerdict;
  try {
    verdict = normalizeVerdict(await editWithEditor(desk, lead, draft, guidance));
  } catch (err) {
    if (isLlmQuotaError(err)) throw err;
    if (!isUnusableEditorPayload(err)) throw err;
    verdict = normalizeVerdict({
      approved: false,
      score: 0,
      editedTitle: lead.topic,
      editedSlug: "",
      editedContent: draft,
      excerpt: "",
    });
  }

  let prepared = prepareWireBody(
    lead,
    verdict.editedTitle,
    verdict.editedSlug,
    verdict.editedContent,
    FALLBACK_COVER_IMAGE,
    related,
  );

  if (prepared.failures.length) {
    try {
      verdict = normalizeVerdict(
        await repairWithEditor(desk, lead, verdict, prepared.failures, guidance),
      );
      prepared = prepareWireBody(
        lead,
        verdict.editedTitle,
        verdict.editedSlug,
        verdict.editedContent,
        FALLBACK_COVER_IMAGE,
        related,
      );
    } catch (err) {
      if (isLlmQuotaError(err)) throw err;
    }
  }

  verdict = { ...verdict, editedContent: prepared.body, score: prepared.score, approved: prepared.failures.length === 0 };
  const belowBar =
    prepared.failures.length > 0 ||
    prepared.score < minScore ||
    (requireApproved && !verdict.approved);

  if (belowBar) {
    await trySaveHeldDraft(lead, desk, verdict, prepared.body, prepared.failures);
    return holdForHygiene(desk, verdict, prepared.body, prepared.failures, prepared.score);
  }

  return commitVerdict(lead, desk, verdict, related);
}

export async function publishHighestScoringHold(
  outcomes: { lead: NewsLead; result: PipelineResult }[],
  floor = FORCE_PUBLISH_SCORE_MIN,
): Promise<{ lead: NewsLead; result: PipelineResult } | null> {
  const ranked = outcomes
    .filter(
      (
        outcome,
      ): outcome is {
        lead: NewsLead;
        result: Extract<PipelineResult, { published: false }> & { verdict: EditorVerdict };
      } =>
        !outcome.result.published &&
        Boolean(outcome.result.verdict) &&
        outcome.result.score >= floor,
    )
    .sort((a, b) => b.result.score - a.result.score);

  for (const winner of ranked) {
    const verdict = winner.result.verdict;
    const related = await loadRelatedCandidates({
      topic: winner.lead.topic,
      category: winner.lead.category,
    });
    const prepared = prepareWireBody(
      winner.lead,
      verdict.editedTitle.trim(),
      verdict.editedSlug || keywordSlug(verdict.editedTitle),
      verdict.editedContent,
      FALLBACK_COVER_IMAGE,
      related,
    );
    if (prepared.failures.length) continue;
    const desk = winner.result.desk;
    const published = await commitVerdict(
      winner.lead,
      desk,
      { ...verdict, editedContent: prepared.body },
      related,
    );
    if (!published.published) continue;
    return { lead: winner.lead, result: published };
  }

  return null;
}
