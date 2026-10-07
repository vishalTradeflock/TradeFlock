import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  EDITORIAL_LIST_PAD,
  editorialQueryLimit,
  HOME_ARTICLE_LIMIT,
  PAGE_REVALIDATE_SECONDS,
  publishedAtCutoff,
} from "./cache.ts";

test("publishedAtCutoff stays stable inside one ISR window", () => {
  const windowMs = PAGE_REVALIDATE_SECONDS * 1000;
  const start = 1_780_000_000_000;
  const bucket = Math.floor(start / windowMs) * windowMs;
  assert.equal(publishedAtCutoff(bucket + 1), new Date(bucket).toISOString());
  assert.equal(publishedAtCutoff(bucket + windowMs - 1), new Date(bucket).toISOString());
  assert.equal(publishedAtCutoff(bucket + windowMs), new Date(bucket + windowMs).toISOString());
  assert.equal(publishedAtCutoff(bucket).endsWith(".000Z"), true);
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
