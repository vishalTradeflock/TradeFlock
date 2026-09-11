/**
 * One-shot publisher for six EiC-approved, Wire-cleared desk specials.
 *
 * Does not invent copy. Bodies are read from scripts/desk-specials/*.html.
 * If those files are still placeholders, this script exits without writing.
 *
 * Env (from the cloud VM, Vercel production, or a local pull):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Commands:
 *   npx vercel env pull .env.local --environment=production --yes
 *   npx tsx scripts/publish-desk-specials.ts
 *   npx tsx scripts/publish-desk-specials.ts --dry-run
 *
 * There is no revalidate API. Homepage and article routes use
 * `export const revalidate = 0`, so the next request reads fresh rows.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type WriterDesk = "tech" | "markets" | "ma" | "strategy" | "macro" | "retail";

type DeskSpecial = {
  desk: WriterDesk;
  title: string;
  htmlFile: string;
  closerHint: string;
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

const FALLBACK_COVER_IMAGE =
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80";

const PUBLIC_ORIGIN = "https://tradeflock-usa-nine.vercel.app";

const MIN_BODY_CHARS = 2500;

const PIECES: DeskSpecial[] = [
  {
    desk: "macro",
    title:
      "PJM Hits the Capacity Cap Again—and AI Load Turns Power Into Everyone’s Capex Problem",
    htmlFile: "01-macro.html",
    closerHint: "permanent premium embedded in U.S. business power costs",
  },
  {
    desk: "strategy",
    title: "When Boards Buy a Second Boss: Why F500 Directors Are Splitting Chair and CEO Again",
    htmlFile: "02-strategy.html",
    closerHint: "Spencer Stuart / EY / Disney / Boeing / Starbucks",
  },
  {
    desk: "retail",
    title: "Starbucks’ Turnaround Isn’t a Brand Story. It’s Square Footage, SKUs, and Labor Hours.",
    htmlFile: "03-retail.html",
    closerHint: "square footage, SKUs, and labor hours",
  },
  {
    desk: "markets",
    title: "When a Hot Jobs Print Rewrites the Soft Landing",
    htmlFile: "04-markets.html",
    closerHint: "hot jobs print / soft landing",
  },
  {
    desk: "tech",
    title: "Broadcom’s AI ASIC Backlog Is a Dual-Source Story—Not an Nvidia Wipeout",
    htmlFile: "05-tech.html",
    closerHint: "dual-source / not an Nvidia wipeout",
  },
  {
    desk: "ma",
    title: "Vertical AI Deals and the Antitrust Clock Nobody Budgeted",
    htmlFile: "06-ma.html",
    closerHint: "vertical AI / antitrust clock",
  },
];

function repoRoot() {
  return process.cwd();
}

function loadEnvLocal() {
  const envPath = resolve(repoRoot(), ".env.local");
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

function slugify(title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `${base || "desk-note"}-${Date.now().toString(36)}`;
}

function stripTags(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function excerptFromLede(html: string) {
  const match = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  const text = stripTags(match ? match[1] : html);
  if (text.length <= 200) return text;
  const sliced = text.slice(0, 200);
  const lastSpace = sliced.lastIndexOf(" ");
  const clipped = lastSpace > 140 ? sliced.slice(0, lastSpace) : sliced;
  return `${clipped.replace(/[.,;:]+$/, "")}…`;
}

function toHtmlBody(content: string) {
  if (content.includes("<p>") || content.includes("<h3>")) return content.trim();
  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("\n");
}

function isPlaceholderHtml(html: string) {
  const text = stripTags(html);
  return (
    text.length < MIN_BODY_CHARS ||
    /PASTE Wire Editor HTML/i.test(html) ||
    !/<p\b/i.test(html)
  );
}

function readPieceHtml(piece: DeskSpecial) {
  const path = resolve(repoRoot(), "scripts/desk-specials", piece.htmlFile);
  if (!existsSync(path)) {
    throw new Error(`Missing ${path} — paste the Wire-edited HTML for “${piece.title}”.`);
  }
  const raw = readFileSync(path, "utf8").trim();
  const body = toHtmlBody(raw);
  if (isPlaceholderHtml(body)) {
    throw new Error(
      `scripts/desk-specials/${piece.htmlFile} is empty or still a placeholder. Paste the full Wire-edited HTML (lede + <h3> sections; closer should include “${piece.closerHint}”).`,
    );
  }
  return body;
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

async function publishArticle(
  admin: ReturnType<typeof createClient>,
  insert: ArticleInsert,
) {
  const withStatus = await admin.from("articles").insert(insert).select("slug").single();
  if (!withStatus.error) {
    return withStatus.data.slug as string;
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
  return fallback.data.slug as string;
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");

  const bodies: { piece: DeskSpecial; body: string; excerpt: string }[] = [];
  for (const piece of PIECES) {
    const body = readPieceHtml(piece);
    bodies.push({ piece, body, excerpt: excerptFromLede(body) });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Pull production env, then rerun:\n" +
        "  npx vercel env pull .env.local --environment=production --yes\n" +
        "  npx tsx scripts/publish-desk-specials.ts",
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authorSlugs = [...new Set(PIECES.map((piece) => DESK_AUTHOR[piece.desk]))];
  const categorySlugs = [...new Set(PIECES.map((piece) => SITE_CATEGORY[piece.desk]))];

  const [{ data: authors, error: authorError }, { data: categories, error: categoryError }] =
    await Promise.all([
      admin.from("authors").select("id, slug, name").in("slug", authorSlugs),
      admin.from("categories").select("id, slug, name").in("slug", categorySlugs),
    ]);

  if (authorError) throw new Error(`Author lookup failed: ${authorError.message}`);
  if (categoryError) throw new Error(`Category lookup failed: ${categoryError.message}`);

  const authorBySlug = new Map((authors ?? []).map((row) => [row.slug, row]));
  const categoryBySlug = new Map((categories ?? []).map((row) => [row.slug, row]));

  const missingAuthors = authorSlugs.filter((slug) => !authorBySlug.has(slug));
  const missingCategories = categorySlugs.filter((slug) => !categoryBySlug.has(slug));
  if (missingAuthors.length) {
    throw new Error(`Missing desk authors: ${missingAuthors.join(", ")}`);
  }
  if (missingCategories.length) {
    throw new Error(`Missing site categories: ${missingCategories.join(", ")}`);
  }

  console.log("Resolved authors:");
  for (const slug of authorSlugs) {
    const row = authorBySlug.get(slug)!;
    console.log(`  ${slug} -> ${row.name} (${row.id})`);
  }
  console.log("Resolved categories:");
  for (const slug of categorySlugs) {
    const row = categoryBySlug.get(slug)!;
    console.log(`  ${slug} -> ${row.name} (${row.id})`);
  }

  const publishedAt = new Date().toISOString();
  const published: {
    desk: WriterDesk;
    title: string;
    slug: string;
    author: string;
    category: string;
    url: string;
  }[] = [];

  for (const { piece, body, excerpt } of bodies) {
    const author = authorBySlug.get(DESK_AUTHOR[piece.desk])!;
    const category = categoryBySlug.get(SITE_CATEGORY[piece.desk])!;
    const slug = slugify(piece.title);
    const insert: ArticleInsert = {
      slug,
      title: piece.title,
      dek: excerpt,
      excerpt,
      body,
      cover_image_url: FALLBACK_COVER_IMAGE,
      cover_image_alt: piece.title,
      category_id: category.id,
      author_id: author.id,
      is_featured: false,
      is_breaking: false,
      view_count: 0,
      status: "published",
      published_at: publishedAt,
    };

    if (dryRun) {
      console.log(`[dry-run] would insert ${piece.desk} ${slug} (${body.length} chars)`);
      published.push({
        desk: piece.desk,
        title: piece.title,
        slug,
        author: `${author.name} (${author.slug})`,
        category: `${category.name} (${category.slug})`,
        url: `${PUBLIC_ORIGIN}/news/${slug}`,
      });
      continue;
    }

    const savedSlug = await publishArticle(admin, insert);
    published.push({
      desk: piece.desk,
      title: piece.title,
      slug: savedSlug,
      author: `${author.name} (${author.slug})`,
      category: `${category.name} (${category.slug})`,
      url: `${PUBLIC_ORIGIN}/news/${savedSlug}`,
    });
    console.log(`Published ${piece.desk}: ${savedSlug}`);
  }

  console.log("\nDesk specials:");
  for (const row of published) {
    console.log(
      `- [${row.desk}] ${row.title}\n  slug: ${row.slug}\n  author: ${row.author}\n  category: ${row.category}\n  url: ${row.url}`,
    );
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
