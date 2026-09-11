import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const JSON_PATH = resolve(process.cwd(), "wp_articles.json");
const BATCH_SIZE = 50;
const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80";

function loadWpArticles(raw) {
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed) && parsed[0]?.title && parsed[0]?.body) {
    return parsed;
  }
  const table = Array.isArray(parsed)
    ? parsed.find((item) => item?.type === "table" && Array.isArray(item.data))
    : parsed?.data
      ? parsed
      : null;
  if (!table?.data?.length) {
    throw new Error("wp_articles.json has no article rows");
  }
  return table.data;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function cleanHtml(html) {
  let out = String(html || "");

  out = out.replace(/\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/gi, "$1");
  out = out.replace(/\[\/?[a-z][a-z0-9_-]*(?:\s[^\]]*)?\]/gi, "");
  out = out.replace(/\s*style\s*=\s*(["'])[\s\S]*?\1/gi, "");
  out = out.replace(/<h[1-6](\s[^>]*)?>/gi, "<h3$1>");
  out = out.replace(/<\/h[1-6]>/gi, "</h3>");
  out = out.replace(/\n{3,}/g, "\n\n");

  return out.trim();
}

function stripTags(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function excerptFor(row, body) {
  const fromField = String(row.excerpt || "").trim();
  if (fromField) return fromField.slice(0, 320);
  const fromBody = stripTags(body);
  return (fromBody || row.title || "TradeFlock USA").slice(0, 320);
}

function coverUrl(row) {
  const url = String(row.image_url || "").trim();
  if (!url) return FALLBACK_COVER;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return url;
  } catch {
    /* fall through */
  }
  return FALLBACK_COVER;
}

function publishedAt(value) {
  const raw = String(value || "").trim();
  if (!raw) return new Date().toISOString();
  const isoish = raw.includes("T") ? raw : raw.replace(" ", "T");
  const parsed = new Date(isoish.endsWith("Z") ? isoish : `${isoish}Z`);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function categoryName(row) {
  const raw = String(row.category_name || "Others").split(",")[0].trim();
  return raw || "Others";
}

async function upsertBySlug(supabase, table, rows) {
  if (!rows.length) return [];
  const { error } = await supabase.from(table).upsert(rows, { onConflict: "slug" });
  if (error) throw new Error(`${table} upsert failed: ${error.message}`);

  const slugs = rows.map((row) => row.slug);
  const { data, error: selectError } = await supabase
    .from(table)
    .select("id, slug, name")
    .in("slug", slugs);
  if (selectError || !data?.length) {
    throw new Error(`${table} select failed: ${selectError?.message ?? "no rows"}`);
  }
  return data;
}

async function insertBatches(supabase, rows) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const batch = rows.slice(i, i + BATCH_SIZE);
    process.stdout.write(`Inserting batch ${batchNumber} (${batch.length})... `);

    const first = await supabase.from("articles").upsert(batch, { onConflict: "slug" });
    if (first.error?.message.toLowerCase().includes("status")) {
      const withoutStatus = batch.map(({ status: _status, ...rest }) => rest);
      const retry = await supabase.from("articles").upsert(withoutStatus, { onConflict: "slug" });
      if (retry.error) throw new Error(`Batch ${batchNumber} failed: ${retry.error.message}`);
    } else if (first.error) {
      throw new Error(`Batch ${batchNumber} failed: ${first.error.message}`);
    }

    inserted += batch.length;
    console.log(`ok (${inserted}/${rows.length})`);
  }
  return inserted;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY is not set; inserts may fail under RLS.");
  }

  const source = loadWpArticles(readFileSync(JSON_PATH, "utf8"));
  console.log(`Loaded ${source.length} WordPress rows from wp_articles.json`);

  const categoryBySlug = new Map();
  const authorBySlug = new Map();
  for (const row of source) {
    const catName = categoryName(row);
    const catSlug = slugify(catName);
    if (catSlug && !categoryBySlug.has(catSlug)) {
      categoryBySlug.set(catSlug, { name: catName, slug: catSlug });
    }
    const authorName = String(row.author_name || "Staff").trim() || "Staff";
    const authorSlug = slugify(authorName) || "staff";
    if (!authorBySlug.has(authorSlug)) {
      authorBySlug.set(authorSlug, {
        name: authorName,
        slug: authorSlug,
        title: "Staff Writer",
        bio: `TradeFlock USA correspondent.`,
      });
    }
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const categories = await upsertBySlug(supabase, "categories", [...categoryBySlug.values()]);
  const authors = await upsertBySlug(supabase, "authors", [...authorBySlug.values()]);
  const categoryId = new Map(categories.map((row) => [row.slug, row.id]));
  const authorId = new Map(authors.map((row) => [row.slug, row.id]));
  console.log(`Linked ${categories.length} categories and ${authors.length} authors`);

  const usedSlugs = new Set();
  const articles = [];
  for (const row of source) {
    const title = String(row.title || "").trim();
    if (!title) continue;

    const body = cleanHtml(row.body);
    if (!body) continue;

    let slug = slugify(row.slug) || slugify(title);
    if (!slug) continue;
    if (usedSlugs.has(slug)) slug = `${slug}-${row.legacy_id || articles.length}`;
    usedSlugs.add(slug);

    const catSlug = slugify(categoryName(row));
    const authorSlug = slugify(String(row.author_name || "Staff").trim() || "Staff") || "staff";
    const category_id = categoryId.get(catSlug);
    const author_id = authorId.get(authorSlug);
    if (!category_id || !author_id) {
      throw new Error(`Missing FK for "${title}" (category=${catSlug}, author=${authorSlug})`);
    }

    const excerpt = excerptFor(row, body);
    const image_url = coverUrl(row);

    articles.push({
      title,
      slug,
      dek: excerpt,
      excerpt,
      body,
      cover_image_url: image_url,
      cover_image_alt: title,
      published_at: publishedAt(row.published_at),
      category_id,
      author_id,
      is_featured: false,
      is_breaking: false,
      view_count: 0,
      status: "published",
    });
  }

  console.log(`Prepared ${articles.length} articles; inserting in batches of ${BATCH_SIZE}`);
  const inserted = await insertBatches(supabase, articles);
  console.log(`Finished. Upserted ${inserted} articles.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
