import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isValidPublicSlug, proposeCleanSlug } from "../src/lib/studio/slug.ts";
import { buildSlugCleanupReport } from "../src/lib/studio/slug-audit.ts";

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cols = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") {
        cols.push(cur);
        cur = "";
      } else cur += ch;
    }
    cols.push(cur);
    const row = {};
    header.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

function csvField(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

loadEnv(".env.local");
loadEnv(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !service || !anon) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicClient = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchPublished() {
  const rows = [];
  let from = 0;
  while (from < 50_000) {
    const { data, error } = await publicClient
      .from("articles")
      .select("id, slug, status")
      .eq("status", "published")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

async function fetchRedirects() {
  const rows = [];
  let from = 0;
  while (from < 50_000) {
    const { data, error } = await publicClient
      .from("article_slug_redirects")
      .select("old_slug, article_id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

function preflight(csv, published, redirects) {
  const failures = [];
  const liveById = new Map(published.map((r) => [r.id, r]));
  const liveBySlug = new Map(published.map((r) => [r.slug, r.id]));
  const redirectByOld = new Map(redirects.map((r) => [r.old_slug, r.article_id]));
  const liveReport = buildSlugCleanupReport(published.map((r) => ({ id: r.id, slug: r.slug })));
  if (csv.length !== 302) failures.push(`CSV rows ${csv.length} !== 302`);
  if (published.length !== 1271) failures.push(`published ${published.length} !== 1271`);
  if (liveReport.length !== 302) failures.push(`live affected ${liveReport.length} !== 302`);
  if (liveReport.some((r) => r.collisionStatus === "COLLISION")) failures.push("live collisions");
  for (const row of csv) {
    const live = liveById.get(row.article_id);
    if (!live) {
      failures.push(`missing ${row.article_id}`);
      continue;
    }
    if (live.status !== "published") failures.push(`${row.article_id} not published`);
    if (live.slug !== row.current_slug) {
      failures.push(`${row.article_id} slug drift`);
    }
    if (!isValidPublicSlug(row.proposed_slug)) failures.push(`${row.article_id} invalid proposed`);
    if (proposeCleanSlug(row.current_slug) !== row.proposed_slug) {
      failures.push(`${row.article_id} sanitizer mismatch`);
    }
    const owner = liveBySlug.get(row.proposed_slug);
    if (owner && owner !== row.article_id) failures.push(`${row.article_id} proposed taken`);
    const existing = redirectByOld.get(row.current_slug);
    if (existing && existing !== row.article_id) failures.push(`${row.article_id} bad old redirect`);
    const newAsRedirect = redirectByOld.get(row.proposed_slug);
    if (newAsRedirect && newAsRedirect !== row.article_id) {
      failures.push(`${row.article_id} proposed slug is another redirect`);
    }
  }
  return failures;
}

const csv = parseCsv(readFileSync("seo-slug-cleanup-report.csv", "utf8"));
const published = await fetchPublished();
const redirects = await fetchRedirects();
const failures = preflight(csv, published, redirects);
if (failures.length) {
  console.error(JSON.stringify({ aborted: true, failures }, null, 2));
  process.exit(2);
}

const inserted = [];
const updated = [];
const results = csv.map((row) => ({
  article_id: row.article_id,
  old_slug: row.current_slug,
  new_slug: row.proposed_slug,
  redirect_created: "no",
  article_updated: "no",
  verification_status: "pending",
}));
const byId = new Map(results.map((row) => [row.article_id, row]));

async function rollback() {
  for (const row of [...updated].reverse()) {
    await admin.from("articles").update({ slug: row.current_slug }).eq("id", row.article_id).eq("slug", row.proposed_slug);
  }
  for (const row of inserted) {
    await admin.from("article_slug_redirects").delete().eq("old_slug", row.current_slug).eq("article_id", row.article_id);
  }
}

try {
  for (const row of csv) {
    const { error } = await admin.from("article_slug_redirects").insert({
      old_slug: row.current_slug,
      article_id: row.article_id,
    });
    if (error) {
      if (error.code === "23505") {
        const existing = await admin
          .from("article_slug_redirects")
          .select("article_id")
          .eq("old_slug", row.current_slug)
          .maybeSingle();
        if (existing.data?.article_id !== row.article_id) {
          throw new Error(`redirect conflict ${row.article_id}: ${error.message}`);
        }
      } else {
        throw new Error(`redirect insert ${row.article_id}: ${error.message}`);
      }
    } else {
      inserted.push(row);
      byId.get(row.article_id).redirect_created = "yes";
    }
  }

  for (const row of csv) {
    const written = await admin
      .from("articles")
      .update({ slug: row.proposed_slug })
      .eq("id", row.article_id)
      .eq("slug", row.current_slug)
      .eq("status", "published")
      .select("id");
    if (written.error || !written.data?.length) {
      throw new Error(`article update ${row.article_id}: ${written.error?.message ?? "no row updated"}`);
    }
    updated.push(row);
    byId.get(row.article_id).article_updated = "yes";
  }
} catch (error) {
  await rollback();
  console.error(JSON.stringify({
    aborted: true,
    reason: error instanceof Error ? error.message : String(error),
    inserted: inserted.length,
    updated: updated.length,
    rolledBack: true,
  }, null, 2));
  process.exit(3);
}

const afterPublished = await fetchPublished();
const afterRedirects = await fetchRedirects();
const afterReport = buildSlugCleanupReport(afterPublished.map((r) => ({ id: r.id, slug: r.slug })));
const remainingOriginal = csv.filter((row) => afterPublished.some((p) => p.id === row.article_id && p.slug === row.current_slug));
const missingNew = csv.filter((row) => !afterPublished.some((p) => p.id === row.article_id && p.slug === row.proposed_slug));
const redirectHits = csv.filter((row) => afterRedirects.some((r) => r.old_slug === row.current_slug && r.article_id === row.article_id));
const slugDupes = afterPublished.reduce((map, row) => {
  map.set(row.slug, (map.get(row.slug) ?? 0) + 1);
  return map;
}, new Map());
const duplicateSlugs = [...slugDupes.entries()].filter(([, n]) => n > 1);
const redirectDupes = afterRedirects.reduce((map, row) => {
  map.set(row.old_slug, (map.get(row.old_slug) ?? 0) + 1);
  return map;
}, new Map());
const duplicateRedirects = [...redirectDupes.entries()].filter(([, n]) => n > 1);

const postFailures = [];
if (afterPublished.length !== 1271) postFailures.push(`published ${afterPublished.length}`);
if (updated.length !== 302) postFailures.push(`updated ${updated.length}`);
if (redirectHits.length !== 302) postFailures.push(`redirects ${redirectHits.length}`);
if (remainingOriginal.length) postFailures.push(`remaining old ${remainingOriginal.length}`);
if (missingNew.length) postFailures.push(`missing new ${missingNew.length}`);
if (duplicateSlugs.length) postFailures.push("duplicate slugs");
if (duplicateRedirects.length) postFailures.push("duplicate redirects");
if (afterReport.some((r) => csv.some((c) => c.article_id === r.articleId))) {
  postFailures.push("original audit rows still dirty");
}

for (const row of results) {
  row.verification_status = postFailures.length ? "failed_postcheck" : "ok";
}

writeFileSync(
  "seo-slug-cleanup-result.csv",
  [
    "article_id,old_slug,new_slug,redirect_created,article_updated,verification_status",
    ...results.map((row) =>
      [row.article_id, row.old_slug, row.new_slug, row.redirect_created, row.article_updated, row.verification_status]
        .map(csvField)
        .join(","),
    ),
  ].join("\n") + "\n",
);

console.log(JSON.stringify({
  migrated: updated.length,
  redirectsCreated: inserted.length,
  failures: postFailures.length,
  collisions: afterReport.filter((r) => r.collisionStatus === "COLLISION").length,
  remainingDirtyFromOriginalAudit: remainingOriginal.length,
  remainingDirtyAllPublished: afterReport.length,
  published: afterPublished.length,
  postFailures,
}, null, 2));
if (postFailures.length) process.exit(4);