import { revalidatePath } from "next/cache";
import {
  EDITOR_IN_CHIEF_PROMPT,
  WRITER_PROMPTS,
  resolveWriterDesk,
  type WriterDesk,
} from "@/lib/agents/prompts";
import { FALLBACK_COVER_IMAGE } from "@/lib/images";
import { createAdminClient } from "@/lib/supabase/admin";
import { completeLlmChat } from "@/lib/llm";

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
    };

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
    maxTokens: 4096,
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

type ArticleInsert = {
  slug: string;
  title: string;
  dek: string;
  excerpt: string;
  body: string;
  cover_image_url: string;
  cover_image_alt: string;
  category_id: string;
  author_id: string;
  is_featured: false;
  is_breaking: false;
  view_count: number;
  status: "published";
  published_at: string;
};

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

  const { status: _status, ...withoutStatus } = insert;
  const fallback = await admin.from("articles").insert(withoutStatus).select("slug").single();
  if (fallback.error) {
    throw new Error(fallback.error.message);
  }
  return fallback.data.slug;
}

export async function processNewsLead(lead: NewsLead): Promise<PipelineResult> {
  const desk = resolveWriterDesk(lead.category);
  const draft = await draftFromWriter(desk, lead);
  const verdict = await editWithEditor(desk, lead, draft);

  if (!verdict.approved || verdict.score < 8) {
    return {
      published: false,
      score: verdict.score,
      desk,
      title: verdict.editedTitle,
      reason: "Held by the editor-in-chief (score below 8 or not approved).",
    };
  }

  const admin = createAdminClient();
  const siteCategory = SITE_CATEGORY[desk];

  const [{ data: category, error: categoryError }, { data: author, error: authorError }] =
    await Promise.all([
      admin.from("categories").select("id").eq("slug", siteCategory).single(),
      admin.from("authors").select("id").eq("slug", DESK_AUTHOR[desk]).single(),
    ]);

  if (categoryError || !category) {
    throw new Error(`Missing site category "${siteCategory}"`);
  }
  if (authorError || !author) {
    throw new Error(`Missing desk author "${DESK_AUTHOR[desk]}"`);
  }

  const title = verdict.editedTitle.trim();
  const excerpt = verdict.excerpt.trim().slice(0, 280);
  const slug = slugify(title);

  await publishArticle({
    slug,
    title,
    dek: excerpt,
    excerpt,
    body: toHtmlBody(verdict.editedContent),
    cover_image_url: FALLBACK_COVER_IMAGE,
    cover_image_alt: title,
    category_id: category.id,
    author_id: author.id,
    is_featured: false,
    is_breaking: false,
    view_count: 0,
    status: "published",
    published_at: new Date().toISOString(),
  });

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
