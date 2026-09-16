#!/usr/bin/env node
/**
 * Apply corrected bodies for two published wire stories.
 *
 * Updates body, dek, and excerpt by slug. Does NOT change cover_image_url,
 * cover_image_alt, author_id, or published_at.
 *
 * Usage (from repo root):
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/story-fixes/apply-story-fixes.mjs
 *
 * Also reads .env.local if present. If secrets are missing, the script exits
 * without writing to the database.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));

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

function clipExcerpt(value) {
  const text = value.trim();
  if (text.length <= 280) return text;
  return `${text.slice(0, 277).trim()}…`;
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    console.error(
      "Skipping database write: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "HTML is in scripts/story-fixes/. Re-run with production secrets to update the two articles rows:\n" +
        "  NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/story-fixes/apply-story-fixes.mjs",
    );
    process.exit(2);
  }

  const manifest = JSON.parse(readFileSync(resolve(here, "metadata.json"), "utf8"));
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results = [];
  for (const story of manifest.stories) {
    const body = readFileSync(resolve(here, story.html), "utf8").trim();
    const { data: existing, error: lookupError } = await admin
      .from("articles")
      .select("id, slug, cover_image_url, author_id, published_at")
      .eq("slug", story.slug)
      .maybeSingle();

    if (lookupError) {
      throw new Error(`Lookup failed for ${story.slug}: ${lookupError.message}`);
    }
    if (!existing) {
      results.push({ slug: story.slug, updated: false, reason: "not_found" });
      continue;
    }

    const { error } = await admin
      .from("articles")
      .update({
        body,
        dek: story.dek,
        excerpt: clipExcerpt(story.excerpt),
      })
      .eq("slug", story.slug);

    if (error) {
      throw new Error(`Update failed for ${story.slug}: ${error.message}`);
    }

    results.push({
      slug: story.slug,
      updated: true,
      preservedCover: existing.cover_image_url,
      preservedAuthor: existing.author_id,
    });
  }

  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
