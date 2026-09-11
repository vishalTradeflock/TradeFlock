import { revalidatePath } from "next/cache";
import {
  EDITOR_IN_CHIEF_PROMPT,
  PUBLISH_SCORE_MIN,
  WRITER_PROMPTS,
  resolveWriterDesk,
  type WriterDesk,
} from "@/lib/agents/prompts";
import { FALLBACK_COVER_IMAGE } from "@/lib/images";
import { sanitizeArticleBody } from "@/lib/sanitize-article-body";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { completeLlmChat, isLlmQuotaError } from "@/lib/llm";

export type NewsLead = {
  topic: string;
  rawSource: string;
  category: string;
};

export type EditorVerdict = {
  approved: boolean;
  score: number;
  editedTitle: string;
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

export const FORCE_PUBLISH_SCORE_MIN = 6;

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
  return parsed;
}

function slugify(title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `${base || "desk-note"}-${Date.now().toString(36)}`;
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

async function draftFromWriter(desk: WriterDesk, lead: NewsLead) {
  return completeLlmChat({
    system: WRITER_PROMPTS[desk],
    temperature: 0.45,
    maxTokens: 2048,
    user: `Write a 600-to-800-word TradeFlock USA analysis (5–7 substantial paragraphs) with the required <h3> section heads.

Topic: ${lead.topic}
Assigned category: ${lead.category}

Source notes:
${lead.rawSource}`,
  });
}

async function editWithEditor(desk: WriterDesk, lead: NewsLead, draft: string) {
  const raw = await completeLlmChat({
    system: EDITOR_IN_CHIEF_PROMPT,
    temperature: 0.2,
    json: true,
    maxTokens: 8192,
    user: `Desk: ${desk}
Topic: ${lead.topic}
Category: ${lead.category}

Source notes:
${lead.rawSource}

Draft:
${draft}`,
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
}): ArticleInsert {
  return {
    slug: input.slug,
    title: input.title,
    dek: input.excerpt,
    excerpt: input.excerpt,
    body: input.body,
    cover_image_url: FALLBACK_COVER_IMAGE,
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
): Promise<Extract<PipelineResult, { published: true }>> {
  const admin = createAdminClient();
  const [categoryId, authorId] = await Promise.all([
    resolveCategoryId(admin, desk, lead.category),
    resolveAuthorId(admin, desk),
  ]);

  const title = verdict.editedTitle.trim();
  const excerpt = verdict.excerpt.trim().slice(0, 280);
  const slug = slugify(title);
  const body = sanitizeArticleBody(toHtmlBody(verdict.editedContent), {
    title,
    coverImageUrl: FALLBACK_COVER_IMAGE,
  });

  await publishArticle(
    toArticleRow({
      slug,
      title,
      excerpt,
      body,
      category_id: categoryId,
      author_id: authorId,
    }),
  );

  revalidatePath("/");
  revalidatePath("/news/[slug]", "page");

  return {
    published: true,
    slug,
    title,
    score: verdict.score,
    desk,
  };
}

export async function processNewsLead(
  lead: NewsLead,
  options: ProcessLeadOptions = {},
): Promise<PipelineResult> {
  const desk = resolveWriterDesk(lead.category);
  const minScore = options.minScore ?? PUBLISH_SCORE_MIN;
  const requireApproved = options.requireApproved ?? true;
  const draft = await draftFromWriter(desk, lead);

  let verdict: EditorVerdict;
  try {
    verdict = await editWithEditor(desk, lead, draft);
  } catch (err) {
    if (isLlmQuotaError(err)) throw err;
    if (!isUnusableEditorPayload(err)) throw err;
    const message = err instanceof Error ? err.message : "Editor verdict unusable";
    return {
      published: false,
      score: 0,
      desk,
      reason: `Held — editor returned unusable JSON (${message}).`,
    };
  }

  const belowBar =
    verdict.score < minScore || (requireApproved && !verdict.approved);

  if (belowBar) {
    return {
      published: false,
      score: verdict.score,
      desk,
      title: verdict.editedTitle,
      reason: `Held by the editor-in-chief (score below ${minScore} or not approved).`,
      verdict,
    };
  }

  return commitVerdict(lead, desk, verdict);
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

  const winner = ranked[0];
  if (!winner?.result.verdict) return null;

  const desk = winner.result.desk;
  const published = await commitVerdict(winner.lead, desk, winner.result.verdict);
  return { lead: winner.lead, result: published };
}
