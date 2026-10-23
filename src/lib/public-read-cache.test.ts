import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  EDITORIAL_LIST_PAD,
  editorialQueryLimit,
  HOME_ARTICLE_LIMIT,
  PAGE_REVALIDATE_SECONDS,
  PUBLISHED_AT_BUCKET_SECONDS,
  publishedAtCutoff,
} from "./cache.ts";
import { articleCacheTag } from "./sitemap-tag.ts";
import { isRoutableArticleSlug, isRoutableMagazineSlug } from "./public-slug.ts";
import { PERSONA_AUTHOR_SLUGS } from "./newsroom/authorship.ts";

test("publishedAtCutoff stays stable inside one bucket and includes now", () => {
  assert.equal(PAGE_REVALIDATE_SECONDS, 86400);
  const windowMs = PUBLISHED_AT_BUCKET_SECONDS * 1000;
  const start = 1_780_000_000_000;
  const bucketStart = Math.floor(start / windowMs) * windowMs;
  const bucketEnd = bucketStart + windowMs;
  assert.equal(publishedAtCutoff(bucketStart + 1), new Date(bucketEnd).toISOString());
  assert.equal(publishedAtCutoff(bucketEnd - 1), new Date(bucketEnd).toISOString());
  assert.equal(publishedAtCutoff(bucketEnd), new Date(bucketEnd).toISOString());
  assert.equal(publishedAtCutoff(bucketEnd + 1), new Date(bucketEnd + windowMs).toISOString());
  assert.equal(publishedAtCutoff(bucketEnd).endsWith(".000Z"), true);
});

test("public pages use the once-a-day backstop", () => {
  const pages = [
    "../app/(public)/page.tsx",
    "../app/(public)/[slug]/page.tsx",
    "../app/(public)/author/[slug]/page.tsx",
    "../app/(public)/about/page.tsx",
    "../app/(public)/contact/page.tsx",
    "../app/(public)/standards/page.tsx",
    "../app/(public)/tech/page.tsx",
    "../app/(public)/markets/page.tsx",
    "../app/(public)/finance/page.tsx",
    "../app/(public)/leadership/page.tsx",
    "../app/(public)/success-insights/page.tsx",
    "../app/(public)/magazine/page.tsx",
    "../app/(public)/magazine/all/page.tsx",
    "../app/(public)/magazine/[slug]/page.tsx",
    "../app/(public)/magazine/[slug]/read/page.tsx",
  ];
  for (const file of pages) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.match(source, /export const revalidate = 86400/, file);
  }
  const sitemap = readFileSync(new URL("../app/sitemap.xml/route.ts", import.meta.url), "utf8");
  assert.match(sitemap, /export const dynamic = "force-dynamic"/);
  assert.doesNotMatch(sitemap, /^export const revalidate/m);
  assert.match(sitemap, /s-maxage=\$\{PAGE_REVALIDATE_SECONDS\}/);
  assert.match(sitemap, /Vercel-Cache-Tag/);
  assert.match(sitemap, /Vercel-CDN-Cache-Control/);
  const author = readFileSync(new URL("../app/(public)/author/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(author, /export const dynamicParams = false/);
  assert.match(author, /PERSONA_AUTHOR_SLUGS/);
  assert.match(author, /export function generateStaticParams\(\)/);
  assert.doesNotMatch(author, /export const dynamicParams = true/);

  const article = readFileSync(new URL("../app/(public)/[slug]/page.tsx", import.meta.url), "utf8");
  const loaderStart = article.indexOf("async function loadPublishedArticleOrRedirect");
  const loaderEnd = article.indexOf("export async function generateMetadata");
  const loader = article.slice(loaderStart, loaderEnd);
  const guardAt = loader.indexOf("isRoutableArticleSlug");
  const redirectAt = loader.indexOf("resolvePublishedSlugRedirect");
  assert.ok(guardAt >= 0 && redirectAt > guardAt);
  assert.match(loader, /if \(!isRoutableArticleSlug\(requested\)\) \{\s*notFound\(\);/);

  for (const file of [
    "../app/(public)/magazine/[slug]/page.tsx",
    "../app/(public)/magazine/[slug]/read/page.tsx",
    "../app/api/magazine/[slug]/download/route.ts",
  ]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    const guard = source.indexOf("isRoutableMagazineSlug(slug)");
    const read = source.indexOf("getMagazineBySlug(slug)");
    assert.ok(guard >= 0 && read > guard, file);
  }
});

test("junk URLs are rejected before a database read", () => {
  assert.equal(isRoutableArticleSlug("apple-announces-new-ai-strategy"), true);
  assert.equal(isRoutableArticleSlug("40-under-40-usa-2025"), true);
  assert.equal(
    isRoutableArticleSlug("american-airlines-new-coo-inherits-a-pilot-training-bottleneck-into-the-"),
    true,
  );
  assert.equal(
    isRoutableArticleSlug("networking-silicon-not-gpus-is-the-hidden-bill-in-every--ipcqqu"),
    true,
  );
  assert.equal(isRoutableArticleSlug("Apple-Announces-New-AI-Strategy"), true);
  assert.equal(isRoutableArticleSlug("wp-login.php"), false);
  assert.equal(isRoutableArticleSlug(".env"), false);
  assert.equal(isRoutableArticleSlug("xmlrpc.php"), false);
  assert.equal(isRoutableArticleSlug("foo/bar"), false);
  assert.equal(isRoutableArticleSlug(""), false);
  assert.equal(isRoutableArticleSlug("a".repeat(161)), false);
  assert.equal(isRoutableMagazineSlug("chips-power-new-industrial-map"), true);
  assert.equal(isRoutableMagazineSlug("wp-login.php"), false);
  assert.equal(isRoutableMagazineSlug(".env"), false);
  assert.equal(isRoutableMagazineSlug("xmlrpc.php"), false);
});

test("article cache tags stay on one story", () => {
  assert.equal(articleCacheTag("Apple-Announces-New-AI-Strategy"), "article:apple-announces-new-ai-strategy");
  assert.equal(articleCacheTag("/old-slug/"), "article:old-slug");
  assert.equal(articleCacheTag(""), null);
  assert.equal(articleCacheTag("foo/bar"), null);
  assert.equal(articleCacheTag("a".repeat(300)), null);
  for (const slug of PERSONA_AUTHOR_SLUGS) {
    assert.equal(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug), true, slug);
  }
});

test("editorial list pad replaces the old +80 over-fetch", () => {
  assert.equal(EDITORIAL_LIST_PAD, 8);
  assert.equal(editorialQueryLimit(HOME_ARTICLE_LIMIT), 68);
  assert.equal(editorialQueryLimit(12), 20);
  assert.equal(editorialQueryLimit(9), 17);
  assert.equal(editorialQueryLimit(5), 13);
  assert.equal(editorialQueryLimit(8), 16);
});

test("public article reads use the bucketed cutoff and do not key related stories by article id", () => {
  const source = readFileSync(new URL("./articles.ts", import.meta.url), "utf8");
  assert.match(source, /\.lte\("published_at", publishedAtCutoff\(\)\)/);
  assert.doesNotMatch(source, /\.lte\("published_at", new Date\(\)\.toISOString\(\)\)/);
  assert.doesNotMatch(source, /limit \+ 80/);
  const related = source.slice(source.indexOf("export const getRelatedArticles"));
  const queries = [...related.matchAll(/await queryList\(\{[\s\S]*?\}\)/g)].map((match) => match[0]);
  assert.equal(queries.length, 2);
  for (const query of queries) {
    assert.doesNotMatch(query, /excludeId/);
  }
});
