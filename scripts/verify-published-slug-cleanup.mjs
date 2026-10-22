import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { needsSlugCleanup, proposeCleanSlug } from "../src/lib/studio/slug.ts";
import { buildSlugCleanupReport } from "../src/lib/studio/slug-audit.ts";
import { sitemapNewsPath } from "../src/lib/sitemap-urls.ts";
import { PRODUCTION_ORIGIN } from "../src/lib/site-url.ts";

function newsArticleUrl(slug) {
  return `${PRODUCTION_ORIGIN}/news/${slug}`;
}

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

loadEnv(".env.local");
loadEnv(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchAll(table, columns) {
  const rows = [];
  let from = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await admin.from(table).select(columns).range(from, from + size - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < size) break;
    from += size;
  }
  return rows;
}

async function fetchPublished() {
  const rows = [];
  let from = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await admin
      .from("articles")
      .select("id, slug, status")
      .eq("status", "published")
      .range(from, from + size - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < size) break;
    from += size;
  }
  return rows;
}

const report = parseCsv(readFileSync("seo-slug-cleanup-report.csv", "utf8"));
const result = parseCsv(readFileSync("seo-slug-cleanup-result.csv", "utf8"));
const published = await fetchPublished();
const redirects = await fetchAll("article_slug_redirects", "old_slug, article_id");
const byId = new Map(published.map((row) => [row.id, row]));
const slugCounts = published.reduce((map, row) => {
  map.set(row.slug, (map.get(row.slug) ?? 0) + 1);
  return map;
}, new Map());
const redirectCounts = redirects.reduce((map, row) => {
  map.set(row.old_slug, (map.get(row.old_slug) ?? 0) + 1);
  return map;
}, new Map());

const oldSlugs = new Set(report.map((row) => row.current_slug));
const newSlugs = new Set(report.map((row) => row.proposed_slug));
const remainingOld = published.filter((row) => oldSlugs.has(row.slug));
const missingNew = report.filter((row) => byId.get(row.article_id)?.slug !== row.proposed_slug);
const redirectHits = report.filter((row) =>
  redirects.some((r) => r.old_slug === row.current_slug && r.article_id === row.article_id),
);
const collisions = [...slugCounts.entries()].filter(([, n]) => n > 1);
const duplicateRedirects = [...redirectCounts.entries()].filter(([, n]) => n > 1);
const afterReport = buildSlugCleanupReport(
  published.map((row) => ({ id: row.id, slug: row.slug })),
);
const originalStillDirty = afterReport.filter((row) =>
  report.some((c) => c.article_id === row.articleId),
);

const newsUrls = published
  .map((row) => {
    const path = sitemapNewsPath(row.slug);
    return path ? newsArticleUrl(row.slug) : null;
  })
  .filter(Boolean);
const skipped = published.filter((row) => !sitemapNewsPath(row.slug));
const sitemapOldPresent = newsUrls.filter((u) =>
  [...oldSlugs].some((slug) => u.endsWith(`/news/${slug}`)),
);
const sitemapNewMissing = [...newSlugs].filter(
  (slug) => !newsUrls.some((u) => u.endsWith(`/news/${slug}`)),
);
const endsHyphen = newsUrls.filter((u) => u.endsWith("-"));
const keySuffix = newsUrls.filter((u) => {
  const slug = u.split("/news/")[1] ?? "";
  return needsSlugCleanup(slug);
});
const notNews = newsUrls.filter((u) => !u.includes("/news/"));

const resultOk = result.filter((row) => row.verification_status === "ok").length;
const resultYes = result.filter((row) => row.redirect_created === "yes" && row.article_updated === "yes").length;

const summary = {
  published: published.length,
  reportRows: report.length,
  resultRows: result.length,
  resultOk,
  resultYes,
  oldSlugsChanged: report.length - remainingOld.length,
  remainingOld: remainingOld.length,
  missingNew: missingNew.length,
  redirects: redirects.length,
  redirectHits: redirectHits.length,
  duplicateCurrentSlugs: collisions.length,
  duplicateRedirectOldSlugs: duplicateRedirects.length,
  remainingDirtyFromOriginalAudit: originalStillDirty.length,
  remainingDirtyAllPublished: afterReport.length,
  collisions: afterReport.filter((r) => r.collisionStatus === "COLLISION").length,
  sitemapArticleCount: newsUrls.length,
  sitemapSkippedInvalid: skipped.length,
  sitemapOldPresent: sitemapOldPresent.length,
  sitemapNewMissing: sitemapNewMissing.length,
  sitemapEndsHyphen: endsHyphen.length,
  sitemapNeedsCleanup: keySuffix.length,
  sitemapNotNews: notNews.length,
};

console.log(JSON.stringify(summary, null, 2));
if (
  summary.published !== 1271 ||
  summary.oldSlugsChanged !== 302 ||
  summary.redirectHits !== 302 ||
  summary.duplicateCurrentSlugs ||
  summary.duplicateRedirectOldSlugs ||
  summary.remainingDirtyFromOriginalAudit ||
  summary.remainingDirtyAllPublished ||
  summary.collisions ||
  summary.sitemapOldPresent ||
  summary.sitemapNewMissing ||
  summary.sitemapEndsHyphen ||
  summary.sitemapNeedsCleanup ||
  summary.sitemapNotNews ||
  summary.resultOk !== 302
) {
  process.exit(4);
}
