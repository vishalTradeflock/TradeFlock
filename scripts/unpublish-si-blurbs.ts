#!/usr/bin/env node
/**
 * One-shot cleanup: unpublish short Success Insights “to watch” / profile blurbs
 * (imported WordPress listicles that are one-paragraph bios, not news) and
 * recategorize stray SI listicles sitting on editorial desks (e.g. Leadership).
 *
 * Does NOT delete rows. Sets status to `draft`. Live DB cleanup only happens
 * when you run this with production env — same pattern as story-fixes.
 *
 * Usage (from repo root):
 *   node --experimental-strip-types scripts/unpublish-si-blurbs.ts --dry-run
 *   node --experimental-strip-types scripts/unpublish-si-blurbs.ts
 *
 * Env (also reads .env.local if present):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * If those secrets are missing, the script prints this help and exits without
 * writing. Do not invent keys.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  countRealParagraphs,
  isSuccessInsightsArticle,
  isSuccessInsightsCategory,
  shouldRecategorizeToSuccessInsights,
  shouldUnpublishSiBlurb,
  stripHtmlToText,
  SUCCESS_INSIGHTS_NAME,
  SUCCESS_INSIGHTS_SLUG,
} from "../src/lib/success-insights.ts";

const PAGE_SIZE = 1000;
const UPDATE_CHUNK = 50;
const LIST_SELECT = [
  "id",
  "slug",
  "title",
  "status",
  "category_id",
  "category:categories(id,name,slug)",
].join(",");

type CategoryRef = { id?: string; slug?: string | null; name?: string | null };

type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  category_id: string;
  body?: string | null;
  category?: CategoryRef | CategoryRef[] | null;
};

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function asCategory(value: CategoryRef | CategoryRef[] | null | undefined): CategoryRef | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function printUsage(reason?: string) {
  if (reason) console.error(reason);
  console.error(`
Success Insights blurb unpublish (does not delete rows).

Dry-run (prints counts/slugs, no writes):
  NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \\
    node --experimental-strip-types scripts/unpublish-si-blurbs.ts --dry-run

Apply against the linked database:
  NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \\
    node --experimental-strip-types scripts/unpublish-si-blurbs.ts

Also reads .env.local from the repo root if present. Live production cleanup
only happens when you pass prod secrets — this script does not invent them.
`.trim());
}

function isDryRun(argv: string[]) {
  return argv.includes("--dry-run") || argv.includes("-n");
}

function wantsHelp(argv: string[]) {
  return argv.includes("--help") || argv.includes("-h");
}

async function createAdmin(url: string, serviceRoleKey: string) {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type AdminClient = Awaited<ReturnType<typeof createAdmin>>;

async function fetchAllPublished(admin: AdminClient) {
  const rows: ArticleRow[] = [];
  let from = 0;
  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await admin
      .from("articles")
      .select(LIST_SELECT)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .range(from, to);
    if (error) throw new Error(`List published articles failed: ${error.message}`);
    const page = (data ?? []) as ArticleRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

async function fetchBodies(admin: AdminClient, ids: string[]) {
  const bodies = new Map<string, string>();
  for (let i = 0; i < ids.length; i += UPDATE_CHUNK) {
    const chunk = ids.slice(i, i + UPDATE_CHUNK);
    const { data, error } = await admin.from("articles").select("id,body").in("id", chunk);
    if (error) throw new Error(`Load bodies failed: ${error.message}`);
    for (const row of data ?? []) {
      bodies.set(String(row.id), typeof row.body === "string" ? row.body : "");
    }
  }
  return bodies;
}

async function findSuccessInsightsCategoryId(admin: AdminClient) {
  const { data, error } = await admin.from("categories").select("id,name,slug");
  if (error) throw new Error(`Load categories failed: ${error.message}`);
  const match = (data ?? []).find((row) => isSuccessInsightsCategory(row));
  return match ? String(match.id) : null;
}

async function updateByIds(
  admin: AdminClient,
  ids: string[],
  patch: Record<string, string>,
) {
  for (let i = 0; i < ids.length; i += UPDATE_CHUNK) {
    const chunk = ids.slice(i, i + UPDATE_CHUNK);
    const { error } = await admin.from("articles").update(patch).in("id", chunk);
    if (error) throw new Error(`Update failed: ${error.message}`);
  }
}

function summarize(article: ArticleRow & { body?: string | null }) {
  const category = asCategory(article.category);
  const text = stripHtmlToText(article.body ?? "");
  const paragraphs = countRealParagraphs(article.body ?? "");
  return {
    slug: article.slug,
    title: article.title,
    category: category?.slug ?? category?.name ?? article.category_id,
    chars: text.length,
    paragraphs,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  if (wantsHelp(argv)) {
    printUsage();
    return;
  }

  loadEnvLocal();
  const dryRun = isDryRun(argv);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    printUsage(
      "Skipping database work: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exit(2);
  }

  const admin = await createAdmin(url, serviceRoleKey);

  const published = await fetchAllPublished(admin);
  const shortlist = published.filter((row) =>
    isSuccessInsightsArticle({
      category: asCategory(row.category),
      title: row.title,
      slug: row.slug,
    }),
  );

  const bodies = await fetchBodies(
    admin,
    shortlist.map((row) => row.id),
  );

  const withBody = shortlist.map((row) => ({
    ...row,
    category: asCategory(row.category),
    body: bodies.get(row.id) ?? "",
  }));

  const toUnpublish = withBody.filter((row) => shouldUnpublishSiBlurb(row));
  const toRecategorize = withBody.filter((row) => shouldRecategorizeToSuccessInsights(row));
  const siCategoryId = await findSuccessInsightsCategoryId(admin);

  console.log(
    dryRun
      ? "Dry run — no writes."
      : "Applying updates (status=draft; recategorize listicles on editorial desks).",
  );
  console.log(`Scanned ${published.length} published articles.`);
  console.log(`Unpublish to draft: ${toUnpublish.length}`);
  for (const row of toUnpublish) {
    const info = summarize(row);
    console.log(
      `  - ${info.slug}  [${info.category}]  ${info.chars} chars, ${info.paragraphs} para`,
    );
  }
  console.log(`Recategorize to ${SUCCESS_INSIGHTS_SLUG}: ${toRecategorize.length}`);
  for (const row of toRecategorize) {
    const info = summarize(row);
    console.log(`  - ${info.slug}  [${info.category}]  (also unpublish: ${toUnpublish.some((item) => item.id === row.id) ? "yes" : "no"})`);
  }

  if (!siCategoryId && toRecategorize.length) {
    console.error(
      `No ${SUCCESS_INSIGHTS_NAME} category row found; recategorize skipped. Unpublish can still proceed.`,
    );
  }

  if (dryRun) {
    console.log("Re-run without --dry-run to write.");
    return;
  }

  const unpublishIds = toUnpublish.map((row) => row.id);
  const recategorizeIds = siCategoryId
    ? toRecategorize.map((row) => row.id)
    : [];

  const both = unpublishIds.filter((id) => recategorizeIds.includes(id));
  const onlyDraft = unpublishIds.filter((id) => !both.includes(id));
  const onlyRecat = recategorizeIds.filter((id) => !both.includes(id));

  if (both.length && siCategoryId) {
    await updateByIds(admin, both, { status: "draft", category_id: siCategoryId });
  }
  if (onlyDraft.length) {
    await updateByIds(admin, onlyDraft, { status: "draft" });
  }
  if (onlyRecat.length && siCategoryId) {
    await updateByIds(admin, onlyRecat, { category_id: siCategoryId });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        unpublished: unpublishIds.length,
        recategorized: recategorizeIds.length,
        slugsUnpublished: toUnpublish.map((row) => row.slug),
        slugsRecategorized: toRecategorize.map((row) => row.slug),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
