#!/usr/bin/env node
/**
 * Cover backfill: every published story that shares a cover image with another
 * story gets a fresh, unused Unsplash photo — the OLDEST story in each group
 * keeps the image. Stories carrying a legacy stock photo (the old skyscraper
 * fallback and the 25-photo desk pool) are all reassigned. If no unused photo
 * is found for a story, it gets "" (the site renders the neutral branded card).
 *
 * Dry run is the default and never writes.
 *
 * Usage (from repo root):
 *   node --experimental-strip-types scripts/dedupe-covers.ts                 # dry run
 *   node --experimental-strip-types scripts/dedupe-covers.ts --json out.json # dry run + report
 *   node --experimental-strip-types scripts/dedupe-covers.ts --apply --limit 50
 *   node --experimental-strip-types scripts/dedupe-covers.ts --redo-slugs
 *   node --experimental-strip-types scripts/dedupe-covers.ts --apply --redo-slugs slug-a,slug-b
 *
 * --apply also re-picks the hardcoded Success Insights covers that were chosen
 * by searching Unsplash for a person's name, before remaining duplicates.
 * --redo-slugs turns that on for a dry run; an optional comma-separated list
 * replaces the hardcoded slug set. Each slug is redone only while its current
 * photo is still one of the ids from that earlier run.
 *
 * Env (also reads .env.local if present):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   required for --apply (and to see drafts in dry run)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *                               enough for a read-only dry run (published rows only)
 *   UNSPLASH_ACCESS_KEY         required for --apply; optional in dry run (then the
 *                               report lists search queries instead of picked photos)
 *
 * Each row tries the source article's photo first (og:image, then a large
 * image). That lookup does not use the Unsplash quota. Unsplash demo keys
 * allow 50 requests/hour. On a rate limit the script keeps taking source
 * photos until the story limit or the ~270s budget, then stops cleanly.
 * Rerun it later — already-fixed stories drop out of the plan.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runCoverBackfill } from "../src/lib/cover-backfill.ts";
import { NAME_QUERY_REDO_SLUGS } from "../src/lib/cover-dedupe.ts";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const raw of readFileSync(envPath, "utf8").split("\n")) {
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

function argValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  return argv[index + 1];
}

function redoSlugArg(argv: string[]): { enabled: boolean; slugs?: string[] } {
  const index = argv.indexOf("--redo-slugs");
  if (index === -1) return { enabled: false };
  const next = argv[index + 1];
  if (next === undefined || next.startsWith("--")) return { enabled: true };
  const slugs = next.split(",").map((slug) => slug.trim()).filter(Boolean);
  return { enabled: true, slugs: slugs.length ? slugs : undefined };
}

function printUsage(message?: string) {
  if (message) console.error(message);
  console.error(
    "Usage: node --experimental-strip-types scripts/dedupe-covers.ts [--dry-run] [--apply] [--limit N] [--redo-slugs [slug,slug]] [--json path]",
  );
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    return;
  }
  loadEnvLocal();

  const apply = argv.includes("--apply") && !argv.includes("--dry-run");
  const limitArg = argValue(argv, "--limit");
  const limit = limitArg ? Number.parseInt(limitArg, 10) : undefined;
  const jsonPath = argValue(argv, "--json");
  const redo = redoSlugArg(argv);
  const redoNameQueries = apply || redo.enabled;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const readOnlyKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY?.trim() || null;

  if (!url) {
    printUsage("Missing NEXT_PUBLIC_SUPABASE_URL.");
    process.exit(2);
  }
  if (apply && !serviceRoleKey) {
    printUsage("--apply needs SUPABASE_SERVICE_ROLE_KEY (run it where that env is already configured).");
    process.exit(2);
  }
  if (apply && !unsplashAccessKey) {
    printUsage("--apply needs UNSPLASH_ACCESS_KEY.");
    process.exit(2);
  }
  const key = apply ? serviceRoleKey : serviceRoleKey || readOnlyKey;
  if (!key) {
    printUsage("Missing a Supabase key (anon/publishable is enough for a dry run).");
    process.exit(2);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log(
    `${apply ? "APPLY" : "DRY RUN"} — ${serviceRoleKey ? "all rows" : "published rows only (read-only key)"}` +
      `${unsplashAccessKey ? "" : " — no UNSPLASH_ACCESS_KEY: listing search queries, not picking photos"}` +
      `${redoNameQueries ? ` — name-query redo (${redo.slugs?.length ?? NAME_QUERY_REDO_SLUGS.length} slugs)` : ""}`,
  );

  const report = await runCoverBackfill(client, {
    apply,
    limit,
    unsplashAccessKey,
    redoNameQueries,
    redoSlugs: redo.slugs,
    log: (line) => console.log(line),
  });

  console.log("\nSummary");
  console.log(`  articles scanned:            ${report.scanned}`);
  console.log(`  published:                   ${report.published}`);
  console.log(`  distinct published covers:   ${report.distinctPublishedCovers}`);
  console.log(`  duplicate cover groups:      ${report.duplicateGroups}`);
  console.log(`  legacy stock-photo rows:     ${report.legacyStockRows}`);
  console.log(`  person-name covers to redo:  ${report.nameQueryRedos}`);
  console.log(`  covers taken from source:    ${report.sourcePhotos}`);
  console.log(`  stories needing a new cover: ${report.toChange}`);
  console.log(`  processed this run:          ${report.processed}`);
  console.log(`  written:                     ${report.applied}`);
  if (report.stoppedReason) console.log(`  stopped: ${report.stoppedReason}`);
  console.log("\nTop shared covers:");
  for (const group of report.topGroups.slice(0, 10)) {
    console.log(`  ${String(group.count).padStart(4)}x ${group.key}${group.legacy ? " (legacy stock)" : ""}`);
    for (const title of group.examples) console.log(`         - ${title}`);
  }

  if (jsonPath) {
    writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`\nReport written to ${jsonPath}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
