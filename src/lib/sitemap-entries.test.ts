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
import { publishedRefreshPaths, sectionPathsForCategory } from "./published-refresh.ts";
import { renderSitemapXml } from "./sitemap-xml.ts";

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

const MISSING_FROM_FROZEN_SITEMAP = [
  "is-starlink-available-in-india",
  "publix-closing-stores",
  "boston-dynamics-ceo-rohit-prasad",
  "avient-new-ceo-mike-frank",
  "nvidia-reflection-ai-talks",
  "joe-rogan-spotify-deal",
  "ccc-intelligent-solutions-sale",
  "applied-digital-earnings-interest-expense",
  "treasury-buyback-results-long-bonds",
  "pacira-viatris-deal",
  "cloudflare-acquires-deno",
  "celeste-pizza-discontinued-conagra",
  "jpmorgan-bond-pitch-treasury-rate-bet",
] as const;

describe("sitemap route isolation", () => {
  it("does not let getMagazines reject the route", () => {
    const source = readFileSync(new URL("./sitemap-source.ts", import.meta.url), "utf8");
    const route = readFileSync(new URL("../app/sitemap.xml/route.ts", import.meta.url), "utf8");
    assert.match(source, /Promise\.allSettled/);
    assert.doesNotMatch(source, /getMagazines/);
    assert.match(route, /export const maxDuration = 60/);
    assert.match(source, /timeoutMs: SITEMAP_QUERY_TIMEOUT_MS/);
    assert.match(source, /const BASE_URL = PRODUCTION_ORIGIN/);
    assert.match(source, /buildSitemap\([\s\S]*BASE_URL/);
    assert.doesNotMatch(source, /\$\{BASE_URL\}\/news\/\$\{/);
    assert.doesNotMatch(`${source}\n${route}`, /export const revalidate = 900/);
  });

  it("stays a dynamic handler so the CDN cannot freeze a build-time urlset", () => {
    const route = readFileSync(new URL("../app/sitemap.xml/route.ts", import.meta.url), "utf8");
    const client = readFileSync(new URL("./supabase/public.ts", import.meta.url), "utf8");
    assert.match(route, /export const dynamic = "force-dynamic"/);
    assert.match(route, /export const revalidate = 0/);
    assert.match(route, /Cache-Control": "private, no-store, max-age=0"/);
    assert.match(route, /renderSitemapXml/);
    assert.match(client, /cache: "force-cache"/);
    assert.match(client, /tags: \[SITEMAP_CACHE_TAG\]/);
    assert.match(client, /revalidate: false/);
    assert.match(client, /cache === "sitemap"/);
  });

  it("expires the sitemap tag when a story is published", () => {
    const helper = readFileSync(new URL("./sitemap-cache.ts", import.meta.url), "utf8");
    const client = readFileSync(new URL("./supabase/public.ts", import.meta.url), "utf8");
    assert.match(helper, /revalidateTag\(SITEMAP_CACHE_TAG, \{ expire: 0 \}\)/);
    assert.match(helper, /revalidateTag\(PUBLISHED_PAGES_CACHE_TAG, \{ expire: 0 \}\)/);
    assert.match(helper, /revalidatePath\("\/sitemap\.xml"\)/);
    assert.match(helper, /publishedRefreshPaths/);
    assert.match(client, /PUBLISHED_PAGES_CACHE_TAG/);
    assert.match(client, /revalidate: PAGE_REVALIDATE_SECONDS/);
    for (const file of [
      "../lib/newsroom/api.ts",
      "../app/studio/actions.ts",
      "../app/api/posts/[id]/route.ts",
      "../lib/sync-magazine.ts",
    ]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      assert.match(source, /revalidatePublishedSitemap\(/);
    }
    const newsroom = readFileSync(new URL("../lib/newsroom/api.ts", import.meta.url), "utf8");
    const publish = newsroom.slice(newsroom.indexOf("async function publishArticle"));
    assert.match(publish, /revalidatePublishedSitemap\(/);
    assert.doesNotMatch(publish, /revalidatePath\("\/", "layout"\)/);
    const studio = readFileSync(new URL("../app/studio/actions.ts", import.meta.url), "utf8");
    const save = studio.slice(studio.indexOf("export async function saveStudioDraft"));
    const saveBody = save.slice(0, save.indexOf("export async function saveStudioAuthor"));
    assert.match(saveBody, /existing\.status === "published" \|\| nextStatus === "published"/);
    assert.doesNotMatch(saveBody, /revalidatePath\("\/", "layout"\)/);
  });
});

describe("published page refresh paths", () => {
  it("refreshes home, the story, its section, its author, and ticker pages", () => {
    assert.deepEqual(sectionPathsForCategory("technology"), ["/tech"]);
    assert.deepEqual(sectionPathsForCategory("success insights"), ["/success-insights"]);
    assert.deepEqual(sectionPathsForCategory("not-a-desk"), []);
    const paths = publishedRefreshPaths({
      articleSlugs: ["apple-announces-new-ai-strategy", "old-slug", ""],
      sectionSlugs: ["tech", "leadership"],
      authorSlugs: ["elena-vasquez"],
      magazineSlugs: ["chips-power-new-industrial-map"],
    });
    for (const path of [
      "/",
      "/about",
      "/contact",
      "/standards",
      "/success-insights",
      "/magazine",
      "/magazine/all",
      "/apple-announces-new-ai-strategy",
      "/old-slug",
      "/tech",
      "/leadership",
      "/author/elena-vasquez",
      "/magazine/chips-power-new-industrial-map",
      "/magazine/chips-power-new-industrial-map/read",
    ]) {
      assert.ok(paths.includes(path), path);
    }
    assert.equal(paths.includes("/finance"), false);
    assert.equal(paths.includes("/markets"), false);
  });

  it("does not invent listing paths when listings are off", () => {
    const paths = publishedRefreshPaths({
      listings: false,
      articleSlugs: ["apple-announces-new-ai-strategy"],
      sectionSlugs: ["finance"],
    });
    assert.deepEqual(paths, ["/apple-announces-new-ai-strategy", "/finance"]);
  });
});

describe("stories missing from the frozen production sitemap", () => {
  it("includes is-starlink-available-in-india after the document is rebuilt", () => {
    const articles = MISSING_FROM_FROZEN_SITEMAP.map((slug) => ({
      slug,
      published_at: "2026-10-11T18:00:00.000Z",
    }));
    const xml = renderSitemapXml(buildSitemap(articles, []));
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
    assert.match(xml, /<\/urlset>\n$/);
    assert.equal(xml.includes("<sitemapindex"), false);
    for (const slug of MISSING_FROM_FROZEN_SITEMAP) {
      assert.match(xml, new RegExp(`<loc>${PRODUCTION_ORIGIN}/${slug}</loc>`));
    }
    assert.match(xml, /<loc>https:\/\/www\.tradeflock\.net\/is-starlink-available-in-india<\/loc>/);
  });
});
