import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  ARTICLE_REVALIDATE_SECONDS,
  EDITORIAL_LISTINGS_TAG,
  LISTING_REVALIDATE_SECONDS,
  publicReadCache,
} from "./cache.ts";
import {
  pathsForPublishedArticle,
  pathsForPublishedArticles,
  tagsForPublishedArticle,
} from "./revalidate-paths.ts";

function read(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("published article invalidation", () => {
  it("refreshes the story, its desk, its author, the homepage, and the sitemap", () => {
    const paths = pathsForPublishedArticle({
      slug: "fed-holds",
      previousSlug: "fed-holds-old",
      categorySlug: "markets",
      previousCategorySlug: "finance",
      authorSlug: "elena-vasquez",
      previousAuthorSlug: "newsroom",
    }).sort();
    assert.deepEqual(paths, [
      "/",
      "/author/elena-vasquez",
      "/author/newsroom",
      "/fed-holds",
      "/fed-holds-old",
      "/finance",
      "/markets",
      "/sitemap.xml",
    ]);
  });

  it("maps the technology alias onto the tech desk and skips unknown desks", () => {
    const paths = pathsForPublishedArticle({
      slug: "chip-export",
      categorySlug: "technology",
      previousCategorySlug: "not-a-desk",
    });
    assert.equal(paths.includes("/tech"), true);
    assert.equal(paths.includes("/not-a-desk"), false);
    assert.equal(paths.includes("/success-insights"), false);
  });

  it("includes Success Insights when that is the desk", () => {
    const paths = pathsForPublishedArticle({
      slug: "profile",
      categorySlug: "success-insights",
    });
    assert.equal(paths.includes("/success-insights"), true);
    const tags = tagsForPublishedArticle({
      slug: "profile",
      categorySlug: "success-insights",
    });
    assert.equal(tags.includes("success-insights"), true);
  });

  it("does not invent paths for unrelated stories", () => {
    const paths = pathsForPublishedArticles([
      { slug: "one", categorySlug: "tech" },
      { slug: "two", categorySlug: "tech" },
    ]);
    assert.deepEqual(
      paths.filter((path) => path !== "/" && path !== "/sitemap.xml" && path !== "/tech").sort(),
      ["/one", "/two"],
    );
  });

  it("tags the shared listings and the one story, not every story", () => {
    const tags = tagsForPublishedArticle({
      slug: "fed-holds",
      previousSlug: "fed-holds-old",
      authorId: "author-1",
      previousAuthorId: "author-2",
    });
    assert.equal(tags.includes(EDITORIAL_LISTINGS_TAG), true);
    assert.equal(tags.includes("sitemap"), true);
    assert.equal(tags.includes("article:fed-holds"), true);
    assert.equal(tags.includes("article:fed-holds-old"), true);
    assert.equal(tags.includes("slug-redirect:fed-holds-old"), true);
    assert.equal(tags.includes("author-articles:author-1"), true);
    assert.equal(tags.includes("author-articles:author-2"), true);
    assert.equal(tags.includes("success-insights"), false);
    const desks = tagsForPublishedArticle({
      slug: "fed-holds",
      categorySlug: "markets",
      previousCategorySlug: "finance",
    });
    assert.equal(desks.includes("desk:markets"), true);
    assert.equal(desks.includes("desk:finance"), true);
    assert.equal(desks.includes("desk:tech"), false);
  });
});

describe("fetch cache scope", () => {
  it("keeps story-page reads off the shared listing tag", () => {
    const embedded = publicReadCache("embedded");
    assert.equal(embedded.revalidate, ARTICLE_REVALIDATE_SECONDS);
    assert.equal("tags" in embedded, false);
    const listing = publicReadCache("listing");
    assert.equal(listing.revalidate, LISTING_REVALIDATE_SECONDS);
    assert.deepEqual(listing.tags, [EDITORIAL_LISTINGS_TAG]);
    const markets = publicReadCache("listing", undefined, "markets");
    assert.deepEqual(markets.tags, ["desk:markets"]);
    const tech = publicReadCache("listing", undefined, "technology");
    assert.deepEqual(tech.tags, ["desk:tech"]);
    const author = publicReadCache("author", "author-1");
    assert.deepEqual(author.tags, ["author-articles:author-1"]);
    assert.equal(ARTICLE_REVALIDATE_SECONDS, 86400);
    assert.equal(LISTING_REVALIDATE_SECONDS, 3600);
  });
});

describe("ISR configuration", () => {
  const listing = [
    "../app/(public)/page.tsx",
    "../app/(public)/tech/page.tsx",
    "../app/(public)/markets/page.tsx",
    "../app/(public)/leadership/page.tsx",
    "../app/(public)/finance/page.tsx",
    "../app/(public)/success-insights/page.tsx",
    "../app/(public)/author/[slug]/page.tsx",
    "../app/(public)/magazine/page.tsx",
    "../app/(public)/magazine/all/page.tsx",
    "../app/(public)/magazine/[slug]/page.tsx",
  ];
  const daily = [
    "../app/(public)/[slug]/page.tsx",
    "../app/(public)/about/page.tsx",
    "../app/(public)/contact/page.tsx",
    "../app/(public)/standards/page.tsx",
    "../app/(public)/magazine/[slug]/read/page.tsx",
    "../app/sitemap.ts",
  ];

  it("uses a one-hour safety net on listings and a one-day safety net on stories", () => {
    for (const file of listing) {
      const source = read(file);
      assert.match(source, /export const revalidate = 3600;/);
      assert.doesNotMatch(source, /export const revalidate = (60|120);/);
    }
    for (const file of daily) {
      assert.match(read(file), /export const revalidate = 86400;/);
    }
  });

  it("does not purge the root layout when a story changes", () => {
    for (const file of [
      "../lib/revalidate-public.ts",
      "../lib/newsroom/api.ts",
      "../app/api/posts/[id]/route.ts",
      "../app/api/cron/dedupe-covers/route.ts",
      "../lib/sync-magazine.ts",
    ]) {
      assert.doesNotMatch(read(file), /revalidatePath\(\s*"\/"\s*,\s*"layout"\s*\)/);
    }
    const actions = read("../app/studio/actions.ts");
    const story = actions.slice(
      actions.indexOf("async function revalidatePublishedStory"),
      actions.indexOf("export async function saveStudioDraft"),
    );
    assert.doesNotMatch(story, /revalidatePath/);
    assert.match(actions, /revalidatePath\(\s*"\/"\s*,\s*"layout"\s*\)/);
  });

  it("keeps embedded story-page reads off the listing tag and off millisecond cutoffs", () => {
    const articles = read("./articles.ts");
    const breaking = articles.slice(
      articles.indexOf("export const getBreakingArticles"),
      articles.indexOf("export function toArticleListCard"),
    );
    assert.match(breaking, /getEditorialArticles\(8,\s*"embedded"\)/);
    const related = articles.slice(articles.indexOf("export const getRelatedArticles"));
    assert.match(related, /scope:\s*"embedded"/);
    const authors = read("./authors.ts");
    assert.match(authors, /publishedAtCutoff\(\)/);
    assert.doesNotMatch(authors, /\.lte\("published_at", new Date\(\)\.toISOString\(\)\)/);
    const pub = read("./supabase/public.ts");
    assert.match(pub, /ARTICLE_REVALIDATE_SECONDS/);
    assert.doesNotMatch(pub, /revalidate:\s*PAGE_REVALIDATE_SECONDS/);
    const readPage = read("../app/(public)/magazine/[slug]/read/page.tsx");
    assert.doesNotMatch(readPage, /searchParams/);
  });
});
