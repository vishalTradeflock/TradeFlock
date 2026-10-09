import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { PRODUCTION_ORIGIN } from "./site-url.ts";
import {
  buildSitemap,
  isUndefinedColumn,
  sourceOrFallback,
  type SitemapMagazineRow,
} from "./sitemap-entries.ts";

const ARTICLE = "apple-announces-new-ai-strategy";
const MAGAZINE = "chips-power-new-industrial-map";

describe("sitemap entry builder", () => {
  it("keeps article URLs when magazines are missing", () => {
    const urls = buildSitemap(
      [{ slug: ARTICLE, published_at: "2026-01-02T00:00:00.000Z" }],
      null,
    ).map((entry) => entry.url);

    assert.ok(urls.includes(`${PRODUCTION_ORIGIN}/${ARTICLE}`));
    assert.ok(urls.includes(`${PRODUCTION_ORIGIN}/magazine`));
    assert.equal(urls[0], PRODUCTION_ORIGIN);
  });

  it("keeps magazine URLs when articles are missing", () => {
    const urls = buildSitemap(undefined, [
      { slug: MAGAZINE, published_at: "2026-07-06T10:00:00.000Z", status: "published" },
      { slug: "draft-issue", status: "draft", published_at: "2026-01-01T00:00:00.000Z" },
      { slug: "Not A Slug" },
    ]).map((entry) => entry.url);

    assert.ok(urls.includes(`${PRODUCTION_ORIGIN}/magazine/${MAGAZINE}`));
    assert.equal(urls.some((url) => url.endsWith("/magazine/draft-issue")), false);
    assert.equal(urls.some((url) => url.includes("Not")), false);
    assert.equal(urls.some((url) => url.includes(`/${ARTICLE}`)), false);
  });

  it("drops one bad row without dropping the rest", () => {
    const urls = buildSitemap(
      [
        { slug: "Hello World" },
        { slug: "salesforce-ceo-warns-of-ai-risks-" },
        { slug: ARTICLE, updated_at: "not-a-date" },
        { slug: 12 as unknown as string },
      ],
      [{ slug: "bad slug" }, { slug: MAGAZINE }],
    ).map((entry) => entry.url);

    assert.ok(urls.includes(`${PRODUCTION_ORIGIN}/${ARTICLE}`));
    assert.ok(urls.includes(`${PRODUCTION_ORIGIN}/magazine/${MAGAZINE}`));
    assert.equal(urls.filter((url) => url.includes(ARTICLE)).length, 1);
  });

  it("uses the sibling source when one read rejects", () => {
    const articles = sourceOrFallback(
      { status: "fulfilled" as const, value: [{ slug: ARTICLE }] },
      [],
    );
    const magazines = sourceOrFallback<SitemapMagazineRow[]>(
      { status: "rejected" as const, reason: new Error("magazines down") },
      [{ slug: MAGAZINE, published_at: "2026-07-06T10:00:00.000Z" }],
    );
    const urls = buildSitemap(articles, magazines).map((entry) => entry.url);
    assert.ok(urls.includes(`${PRODUCTION_ORIGIN}/${ARTICLE}`));
    assert.ok(urls.includes(`${PRODUCTION_ORIGIN}/magazine/${MAGAZINE}`));
  });

  it("does not treat an aborted request as a missing column", () => {
    assert.equal(isUndefinedColumn({ code: "42703", message: "column updated_at does not exist" }), true);
    assert.equal(
      isUndefinedColumn({
        code: "PGRST204",
        message: "Could not find the 'status' column of 'magazines' in the schema cache",
      }),
      true,
    );
    assert.equal(isUndefinedColumn({ message: "AbortError: The operation was aborted" }), false);
    assert.equal(isUndefinedColumn({ code: "", message: "TypeError: fetch failed" }), false);
    assert.equal(isUndefinedColumn(null), false);
  });
});

describe("sitemap route isolation", () => {
  it("does not let getMagazines reject the route", () => {
    const source = readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");
    assert.match(source, /Promise\.allSettled/);
    assert.doesNotMatch(source, /getMagazines/);
    assert.match(source, /export const maxDuration = 60/);
    assert.match(source, /export const revalidate = 900;/);
    assert.match(source, /timeoutMs: SITEMAP_QUERY_TIMEOUT_MS/);
    assert.match(source, /const BASE_URL = PRODUCTION_ORIGIN/);
    assert.doesNotMatch(source, /\$\{BASE_URL\}\/news\/\$\{/);
  });
});
