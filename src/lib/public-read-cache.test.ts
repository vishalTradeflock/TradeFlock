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
  assert.match(sitemap, /export const revalidate = 86400/);
  assert.match(sitemap, /s-maxage=\$\{PAGE_REVALIDATE_SECONDS\}/);
  assert.doesNotMatch(sitemap, /export const revalidate = 0/);
  const author = readFileSync(new URL("../app/(public)/author/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(author, /export function generateStaticParams\(\)/);
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
