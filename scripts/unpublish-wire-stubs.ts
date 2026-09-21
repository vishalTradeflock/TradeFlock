#!/usr/bin/env node
/**
 * One-shot cleanup: unpublish the Gemini briefing stub (and similarly short
 * recent wire stubs) by setting status to `draft`. Does NOT delete rows.
 *
 * Live DB cleanup only happens when you run this with production env — same
 * pattern as scripts/unpublish-si-blurbs.ts and scripts/story-fixes.
 * CI must not supply prod credentials; missing env prints help and exits.
 *
 * Always targets slug:
 *   google-s-gemini-breaks-out-and-hacks-computer-systems-amid-rising-ai-scrutiny
 *
 * Also scans recent published editorial-desk stories whose stripped body is
 * below the Forbes word floor (default 14 days, same 550-word gate as the
 * pipeline). Success Insights blurbs are left to unpublish-si-blurbs.ts.
 *
 * Usage (from repo root):
 *   node --experimental-strip-types scripts/unpublish-wire-stubs.ts --dry-run
 *   node --experimental-strip-types scripts/unpublish-wire-stubs.ts
 *   node --experimental-strip-types scripts/unpublish-wire-stubs.ts --no-scan
 *
 * Env (also reads .env.local if present):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ARTICLE_MIN_WORDS,
  countBodyWords,
} from "../src/lib/agents/wire-hygiene.ts";
import {
  EDITORIAL_DESK_SLUGS,
  isSuccessInsightsArticle,
} from "../src/lib/success-insights.ts";

export const GEMINI_STUB_SLUG =
  "google-s-gemini-breaks-out-and-hacks-computer-systems-amid-rising-ai-scrutiny";

const PAGE_SIZE = 1000;
const UPDATE_CHUNK = 50;
const DEFAULT_SCAN_DAYS = 14;
const LIST_SELECT = [
  "id",
  "slug",
  "title",
  "status",
  "published_at",
  "category_id",
  "category:categories(id,name,slug)",
].join(",");

type CategoryRef = { id?: string; slug?: string | null; name?: string | null };

type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  published_at?: string | null;
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
Wire-stub unpublish (does not delete rows). Sets status to draft.

Always includes slug:
  ${GEMINI_STUB_SLUG}

Dry-run (prints slugs/word counts, no writes):
  NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \\
    node --experimental-strip-types scripts/unpublish-wire-stubs.ts --dry-run

Apply against the linked database:
  NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \\
    node --experimental-strip-types scripts/unpublish-wire-stubs.ts

Named slug only (skip the recent short-stub scan):
  ... scripts/unpublish-wire-stubs.ts --no-scan

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

function skipScan(argv: string[]) {
  return argv.includes("--no-scan");
}

async function createAdmin(url: string, serviceRoleKey: string) {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type AdminClient = Awaited<ReturnType<typeof createAdmin>>;

function isEditorialDesk(category: CategoryRef | null): boolean {
  const slug = String(category?.slug ?? "").trim().toLowerCase();
  const name = String(category?.name ?? "").trim().toLowerCase();
  return (
    EDITORIAL_DESK_SLUGS.includes(slug as (typeof EDITORIAL_DESK_SLUGS)[number]) ||
    EDITORIAL_DESK_SLUGS.includes(name as (typeof EDITORIAL_DESK_SLUGS)[number])
  );
}

function isRecentEnough(publishedAt: string | null | undefined, sinceMs: number): boolean {
  if (!publishedAt) return false;
  const ms = Date.parse(publishedAt);
  if (!Number.isFinite(ms)) return false;
  return ms >= sinceMs;
}

function shouldUnpublishWireStub(article: {
  slug: string;
  title?: string | null;
  body?: string | null;
  published_at?: string | null;
  category?: CategoryRef | null;
  alwaysSlugs: Set<string>;
  scan: boolean;
  sinceMs: number;
}): boolean {
  if (article.alwaysSlugs.has(article.slug)) return true;
  if (!article.scan) return false;
  if (isSuccessInsightsArticle({
    category: article.category,
    title: article.title,
    slug: article.slug,
  })) {
    return false;
  }
  if (!isEditorialDesk(article.category ?? null)) return false;
  if (!isRecentEnough(article.published_at, article.sinceMs)) return false;
  return countBodyWords(article.body ?? "") < ARTICLE_MIN_WORDS;
}

async function fetchPublished(admin: AdminClient) {
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

async function fetchBySlugs(admin: AdminClient, slugs: string[]) {
  if (!slugs.length) return [] as ArticleRow[];
  const { data, error } = await admin
    .from("articles")
    .select(LIST_SELECT)
    .in("slug", slugs);
  if (error) throw new Error(`Lookup slugs failed: ${error.message}`);
  return (data ?? []) as ArticleRow[];
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

async function updateByIds(admin: AdminClient, ids: string[], patch: Record<string, string>) {
  for (let i = 0; i < ids.length; i += UPDATE_CHUNK) {
    const chunk = ids.slice(i, i + UPDATE_CHUNK);
    const { error } = await admin.from("articles").update(patch).in("id", chunk);
    if (error) throw new Error(`Update failed: ${error.message}`);
  }
}

function summarize(article: ArticleRow & { body?: string | null }) {
  const category = asCategory(article.category);
  return {
    slug: article.slug,
    title: article.title,
    status: article.status,
    category: category?.slug ?? category?.name ?? article.category_id,
    words: countBodyWords(article.body ?? ""),
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
  const scan = !skipScan(argv);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    printUsage(
      "Skipping database work: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exit(2);
  }

  const admin = await createAdmin(url, serviceRoleKey);
  const alwaysSlugs = new Set([GEMINI_STUB_SLUG]);
  const sinceMs = Date.now() - DEFAULT_SCAN_DAYS * 24 * 60 * 60 * 1000;

  const named = await fetchBySlugs(admin, [...alwaysSlugs]);
  const published = scan ? await fetchPublished(admin) : named.filter((row) => row.status === "published");

  const byId = new Map<string, ArticleRow>();
  for (const row of [...named, ...published]) {
    byId.set(row.id, row);
  }
  const shortlist = [...byId.values()];

  const bodies = await fetchBodies(
    admin,
    shortlist.map((row) => row.id),
  );

  const withBody = shortlist.map((row) => ({
    ...row,
    category: asCategory(row.category),
    body: bodies.get(row.id) ?? "",
  }));

  const toUnpublish = withBody.filter((row) =>
    shouldUnpublishWireStub({
      slug: row.slug,
      title: row.title,
      body: row.body,
      published_at: row.published_at,
      category: asCategory(row.category),
      alwaysSlugs,
      scan,
      sinceMs,
    }) && row.status === "published",
  );

  const missingNamed = [...alwaysSlugs].filter(
    (slug) => !withBody.some((row) => row.slug === slug),
  );
  const alreadyDraft = withBody.filter(
    (row) => alwaysSlugs.has(row.slug) && row.status !== "published",
  );

  console.log(dryRun ? "Dry run — no writes." : "Applying updates (status=draft).");
  console.log(`Named slug: ${GEMINI_STUB_SLUG}`);
  console.log(`Scan recent editorial stubs (<${ARTICLE_MIN_WORDS} words, ${DEFAULT_SCAN_DAYS}d): ${scan ? "yes" : "no"}`);
  console.log(`Unpublish to draft: ${toUnpublish.length}`);
  for (const row of toUnpublish) {
    const info = summarize(row);
    console.log(`  - ${info.slug}  [${info.category}]  ~${info.words} words`);
  }
  for (const slug of missingNamed) {
    console.log(`  (not found) ${slug}`);
  }
  for (const row of alreadyDraft) {
    console.log(`  (already ${row.status}) ${row.slug}`);
  }

  if (dryRun) {
    console.log("Re-run without --dry-run to write.");
    return;
  }

  const ids = toUnpublish.map((row) => row.id);
  if (ids.length) {
    await updateByIds(admin, ids, { status: "draft" });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        unpublished: ids.length,
        slugsUnpublished: toUnpublish.map((row) => row.slug),
        missingNamed,
        alreadyNotPublished: alreadyDraft.map((row) => row.slug),
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
