import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { runCoverBackfill, type BackfillRow } from "./cover-backfill.ts";
import { coverPhotoKey } from "./cover-dedupe.ts";
import {
  chooseSourceImage,
  evaluateSourceImage,
  extractSourceArticleUrl,
  shouldTrySourcePhoto,
  sourceImageCandidatesFromHtml,
} from "./source-photo.ts";

const SKYSCRAPER = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&w=1200";
const NPR = "https://www.npr.org/2024/01/01/retail-shelf-space";
const GOOD_IMAGE = "https://media.npr.org/assets/img/retail-aisle.jpg";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("extractSourceArticleUrl", () => {
  const body = `
    <p><a href="https://www.tradeflock.com/markets/shelf">TradeFlock</a>
    <a href="/inside-the-retail-shelf-space-allocation-process-for-national-big-box-stores">this story</a>
    <a href="https://twitter.com/intent/tweet?url=${NPR}">share</a>
    <a href="https://www.facebook.com/sharer/sharer.php?u=${NPR}">facebook</a>
    <a href="https://www.linkedin.com/sharing/share-offsite/?url=${NPR}">linkedin</a>
    <a href="${NPR}">NPR</a>
    <a href="https://www.reuters.com/markets/retail">Reuters</a></p>
  `;

  it("skips tradeflock, internal, and social links and uses the first external article", () => {
    assert.equal(extractSourceArticleUrl({ title: "Retail shelf space", body }), NPR);
  });

  it("prefers an off-site canonical URL over the body", () => {
    assert.equal(
      extractSourceArticleUrl({
        title: "Retail shelf space",
        canonicalUrl: "https://www.npr.org/canonical-story",
        body,
      }),
      "https://www.npr.org/canonical-story",
    );
  });

  it("falls through a TradeFlock canonical URL to the body link", () => {
    assert.equal(
      extractSourceArticleUrl({
        title: "Retail shelf space",
        canonicalUrl: "https://tradeflock.com/inside-the-retail-shelf-space",
        body,
      }),
      NPR,
    );
  });

  it("decodes entities in hrefs and ignores mailto and hash links", () => {
    const html = `<a href="#top">top</a><a href="mailto:desk@tradeflock.com">mail</a><a href="https://www.npr.org/a&amp;b">NPR</a>`;
    assert.equal(
      extractSourceArticleUrl({ title: "Retail shelf space", body: html }),
      "https://www.npr.org/a&b",
    );
  });
});

describe("source image rejection", () => {
  it("rejects logo, default, placeholder, favicon, and sprite URLs", () => {
    const urls = [
      "https://cdn.example.com/images/logo.png",
      "https://cdn.example.com/share/default-image.jpg",
      "https://cdn.example.com/img/placeholder.jpg",
      "https://cdn.example.com/favicon.ico",
      "https://cdn.example.com/sprites/icons.png",
      "https://www.federalreserve.gov/images/social-media/social-default-image-opengraph.jpg",
    ];
    for (const url of urls) {
      const decision = evaluateSourceImage(url, new Set());
      assert.equal(decision.ok, false, url);
      assert.equal(decision.reason, "logo", url);
    }
  });

  it("rejects a cover already used by another published story", () => {
    const key = coverPhotoKey(GOOD_IMAGE);
    assert.ok(key);
    const decision = evaluateSourceImage(`${GOOD_IMAGE}?w=1600`, new Set([key]));
    assert.equal(decision.ok, false);
    if (!decision.ok) assert.equal(decision.reason, "duplicate");
  });

  it("rejects the legacy skyscraper stock photo", () => {
    const decision = evaluateSourceImage(SKYSCRAPER, new Set());
    assert.equal(decision.ok, false);
    if (!decision.ok) assert.equal(decision.reason, "legacy");
  });

  it("does not take a source photo for a Success Insights profile", () => {
    const profile = {
      title: "Tom Cyriac",
      slug: "tom-cyriac-most-innovative-global-coos-2026",
      categorySlug: "success-insights",
      body: `<a href="${NPR}">NPR</a>`,
    };
    assert.equal(shouldTrySourcePhoto(profile), false);
    assert.equal(extractSourceArticleUrl(profile), NPR);
    assert.equal(
      shouldTrySourcePhoto({
        title: "Inside the retail shelf space allocation process",
        slug: "inside-the-retail-shelf-space-allocation-process-for-national-big-box-stores",
        categorySlug: "markets",
        body: `<a href="${NPR}">NPR</a>`,
      }),
      true,
    );
  });

  it("prefers og:image, skips a rejected og image, drops tiny images, and absolutizes relative URLs", () => {
    const page = "https://www.npr.org/2024/01/01/shelf";
    const html = `
      <meta property="og:image" content="/images/site-logo.png" />
      <meta name="twitter:image" content="https://media.npr.org/assets/img/twitter-default.png" />
      <img src="/icons/mark.png" width="32" height="32" />
      <img src="/images/retail-aisle.jpg" width="1200" height="800" />
    `;
    const candidates = sourceImageCandidatesFromHtml(html, page);
    assert.deepEqual(candidates, [
      "https://www.npr.org/images/site-logo.png",
      "https://media.npr.org/assets/img/twitter-default.png",
      "https://www.npr.org/images/retail-aisle.jpg",
    ]);
    const chosen = chooseSourceImage(candidates, new Set());
    assert.equal(chosen?.ok, true);
    if (chosen?.ok) assert.equal(chosen.url, "https://www.npr.org/images/retail-aisle.jpg");
  });
});

describe("runCoverBackfill source photo first", () => {
  function fakeClient(rows: BackfillRow[]) {
    const updates: { values: Record<string, unknown>; id?: string }[] = [];
    const client = {
      from: () => ({
        update: (values: Record<string, unknown>) => ({
          eq: (_column: string, id: string) => ({
            eq: () => ({
              select: async () => {
                updates.push({ values, id });
                return { data: [{ id }], error: null };
              },
            }),
          }),
        }),
      }),
    };
    return { client, updates };
  }

  function htmlResponse(imageUrl: string) {
    return new Response(
      `<html><head><meta property="og:image" content="${imageUrl}"></head></html>`,
      { status: 200, headers: { "content-type": "text/html" } },
    );
  }

  const shelf: BackfillRow = {
    id: "shelf",
    title: "Inside the retail shelf space allocation process for national big-box stores",
    slug: "inside-the-retail-shelf-space-allocation-process-for-national-big-box-stores",
    cover_image_url: SKYSCRAPER,
    published_at: "2026-09-24T00:00:00Z",
    status: "published",
    category: { slug: "markets" },
    body: `<p>Source: <a href="${NPR}">NPR</a></p>`,
  };

  it("saves the source photo and does not call Unsplash", async () => {
    let unsplashCalls = 0;
    globalThis.fetch = (async () => {
      unsplashCalls += 1;
      throw new Error("Unsplash should not be called");
    }) as typeof fetch;
    const { client, updates } = fakeClient([shelf]);
    const report = await runCoverBackfill(client, {
      apply: true,
      unsplashAccessKey: "k",
      redoNameQueries: false,
      rows: [shelf],
      fetchPage: async () => htmlResponse(GOOD_IMAGE),
    });
    assert.equal(unsplashCalls, 0);
    assert.equal(report.sourcePhotos, 1);
    assert.equal(report.applied, 1);
    assert.equal(report.changes[0]?.reason, "source_photo");
    assert.equal(report.changes[0]?.newCover, GOOD_IMAGE);
    assert.match(report.changes[0]?.alt ?? "", /retail/i);
    assert.doesNotMatch(report.changes[0]?.alt ?? "", /tom|cyriac|henry|nkumbe/i);
    assert.equal(updates[0]?.values.cover_image_url, GOOD_IMAGE);
    assert.equal(updates[0]?.values.cover_image_alt, report.changes[0]?.alt);
  });

  it("keeps taking source photos after Unsplash is rate limited", async () => {
    const older: BackfillRow = {
      id: "older",
      title: "Markets open higher after the bond auction",
      slug: "markets-open-higher",
      cover_image_url: SKYSCRAPER,
      published_at: "2026-09-01T00:00:00Z",
      status: "published",
      category: { slug: "markets" },
    };
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("api.unsplash.com")) {
        return new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "0" } });
      }
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    const { client, updates } = fakeClient([older, shelf]);
    const report = await runCoverBackfill(client, {
      apply: true,
      unsplashAccessKey: "k",
      redoNameQueries: false,
      rows: [older, shelf],
      fetchPage: async () => htmlResponse("https://media.npr.org/assets/img/big-box-aisle.jpg"),
    });
    assert.match(report.stoppedReason ?? "", /rate limit/);
    assert.match(report.stoppedReason ?? "", /finished rows are skipped automatically/);
    assert.equal(report.changes[0]?.slug, "markets-open-higher");
    assert.equal(report.changes[0]?.newCover, null);
    assert.equal(report.changes[1]?.reason, "source_photo");
    assert.equal(report.changes[1]?.applied, true);
    assert.equal(updates.length, 1);
    assert.equal(updates[0]?.id, "shelf");
  });

  it("stops at the time budget before writing", async () => {
    const { client, updates } = fakeClient([shelf]);
    const report = await runCoverBackfill(client, {
      apply: true,
      unsplashAccessKey: "k",
      redoNameQueries: false,
      rows: [shelf],
      budgetMs: 0,
    });
    assert.equal(report.processed, 0);
    assert.match(report.stoppedReason ?? "", /Time budget/);
    assert.match(report.stoppedReason ?? "", /finished rows are skipped automatically/);
    assert.equal(updates.length, 0);
  });

  it("leaves a Success Insights profile on the topic search", async () => {
    const profile: BackfillRow = {
      id: "tom",
      title: "Tom Cyriac",
      slug: "tom-cyriac-most-innovative-global-coos-2026",
      cover_image_url: "https://images.unsplash.com/photo-1560760253-6fb641776da9",
      published_at: "2026-09-18T00:00:00Z",
      status: "published",
      category: { slug: "success-insights" },
      company: "Cold Chain Partners",
      body: `<a href="${NPR}">NPR</a>`,
    };
    let sourceFetches = 0;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/download")) return new Response("{}", { status: 200 });
      return new Response(
        JSON.stringify({
          results: [
            {
              id: "photo-office",
              alt_description: "glass office interior",
              urls: { raw: "https://images.unsplash.com/photo-office" },
              links: {},
              user: { name: "P", links: { html: "https://unsplash.com/@p" } },
            },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const { client } = fakeClient([profile]);
    const report = await runCoverBackfill(client, {
      apply: true,
      unsplashAccessKey: "k",
      redoNameQueries: true,
      limit: 1,
      rows: [profile],
      fetchPage: async () => {
        sourceFetches += 1;
        return htmlResponse(GOOD_IMAGE);
      },
    });
    assert.equal(sourceFetches, 0);
    assert.equal(report.sourcePhotos, 0);
    assert.equal(report.changes[0]?.reason, "name_query");
    assert.match(report.changes[0]?.newCover ?? "", /photo-office/);
  });
});
