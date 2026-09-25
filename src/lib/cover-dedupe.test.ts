import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  blankRepeatedCovers,
  buildCoverSearchQueries,
  coverPhotoKey,
  isLegacyStockCover,
  pickFirstUnusedCover,
  planCoverReassignments,
} from "./cover-dedupe.ts";
import { pickUniqueCover, UnsplashRateLimitError } from "./cover-picker.ts";
import { runCoverBackfill, type BackfillRow } from "./cover-backfill.ts";

const SKYSCRAPER_1600 =
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80";
const SKYSCRAPER_1200 =
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80";

describe("coverPhotoKey", () => {
  it("treats one Unsplash photo with different params as the same image", () => {
    assert.equal(coverPhotoKey(SKYSCRAPER_1600), "unsplash:photo-1486406146926-c627a92ad1ab");
    assert.equal(coverPhotoKey(SKYSCRAPER_1200), coverPhotoKey(SKYSCRAPER_1600));
    assert.equal(
      coverPhotoKey(
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=abc&w=1080",
      ),
      coverPhotoKey(SKYSCRAPER_1600),
    );
    assert.equal(
      coverPhotoKey("https://plus.unsplash.com/premium_photo-1661-abc?w=800"),
      "unsplash:premium_photo-1661-abc",
    );
  });

  it("ignores scheme, www, case, query and hash for other hosts", () => {
    assert.equal(
      coverPhotoKey("https://mmx.prnewswire.com/media/MS1118010/Rosen-Law-Firm-Logo.jpg?id=OA1&p=original"),
      coverPhotoKey("https://MMX.prnewswire.com/media/MS1118010/Rosen-Law-Firm-Logo.jpg?id=OA2#x"),
    );
    assert.equal(
      coverPhotoKey("https://www.federalreserve.gov/images/social-media/social-default-image-opengraph.jpg"),
      "federalreserve.gov/images/social-media/social-default-image-opengraph.jpg",
    );
  });

  it("does not confuse a non-Unsplash path containing 'photo-' with an Unsplash photo", () => {
    assert.equal(
      coverPhotoKey("https://www.tradeflock.us/wp-content/uploads/photo-1486406146926-c627a92ad1ab.jpg"),
      "tradeflock.us/wp-content/uploads/photo-1486406146926-c627a92ad1ab.jpg",
    );
  });

  it("returns null for empty values", () => {
    assert.equal(coverPhotoKey(""), null);
    assert.equal(coverPhotoKey("   "), null);
    assert.equal(coverPhotoKey(null), null);
    assert.equal(coverPhotoKey(undefined), null);
  });
});

describe("legacy stock detection", () => {
  it("flags the old skyscraper fallback in any crop and the old desk pool", () => {
    assert.equal(isLegacyStockCover(SKYSCRAPER_1600), true);
    assert.equal(isLegacyStockCover(SKYSCRAPER_1200), true);
    assert.equal(
      isLegacyStockCover("https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&q=80"),
      true,
    );
    assert.equal(isLegacyStockCover("https://image.cnbcfm.com/api/v1/image/x.jpg"), false);
  });
});

describe("pickFirstUnusedCover", () => {
  it("skips used images (normalized) and legacy stock, returning the next unused one", () => {
    const used = new Set([coverPhotoKey("https://images.unsplash.com/photo-111-aaa?w=100") as string]);
    const picked = pickFirstUnusedCover(
      [
        SKYSCRAPER_1200,
        "https://images.unsplash.com/photo-111-aaa?w=1600&fit=crop",
        "",
        "https://images.unsplash.com/photo-222-bbb?w=1600",
      ],
      used,
    );
    assert.deepEqual(picked, {
      url: "https://images.unsplash.com/photo-222-bbb?w=1600",
      key: "unsplash:photo-222-bbb",
    });
  });

  it("returns null when every candidate is taken", () => {
    assert.equal(pickFirstUnusedCover([SKYSCRAPER_1600, null, undefined], new Set()), null);
  });
});

describe("blankRepeatedCovers", () => {
  it("never shows one image twice in a list", () => {
    const rows = blankRepeatedCovers([
      { id: "1", cover_image_url: "https://images.unsplash.com/photo-9-z?w=1" },
      { id: "2", cover_image_url: "https://images.unsplash.com/photo-9-z?w=2" },
      { id: "3", cover_image_url: "https://images.unsplash.com/photo-8-y" },
    ]);
    assert.deepEqual(
      rows.map((row) => row.cover_image_url),
      ["https://images.unsplash.com/photo-9-z?w=1", "", "https://images.unsplash.com/photo-8-y"],
    );
  });
});

describe("buildCoverSearchQueries", () => {
  it("leads with the company and person from the headline, not a generic desk term", () => {
    const queries = buildCoverSearchQueries(
      "Constellation Cold Logistics Names Abhy Maharaj CEO",
      "leadership",
    );
    assert.equal(queries[0], "Constellation Cold Logistics logistics warehouse");
    assert.ok(queries.includes("Constellation Cold Logistics"));
    assert.ok(queries.includes("Abhy Maharaj"));
    assert.match(queries.at(-1) ?? "", /^business leader/);
  });

  it("uses headline keywords and a topic visual for sentence-case headlines", () => {
    const queries = buildCoverSearchQueries(
      "Inside the retail shelf-space allocation process for national big-box stores",
      "markets",
    );
    assert.equal(queries[0], "retail shelf-space allocation process");
    assert.ok(queries.includes("retail store aisle"));
    assert.ok(!queries.some((query) => /^(inside|the)\b/i.test(query)));
  });

  it("gives two different stories on the same desk different first queries", () => {
    const a = buildCoverSearchQueries("Ecopetrol Appoints Joaquín Gutiérrez Caballero as Chief Executive Officer", "leadership");
    const b = buildCoverSearchQueries("Constellation Cold Logistics Names Abhy Maharaj CEO", "leadership");
    assert.equal(a[0], "Ecopetrol oil refinery");
    assert.ok(a.includes("Joaquín Gutiérrez Caballero"));
    assert.notEqual(a[0], b[0]);
    assert.ok(a.length <= 8 && new Set(a.map((q) => q.toLowerCase())).size === a.length);
  });
});

describe("planCoverReassignments", () => {
  const row = (id: string, cover: string | null, publishedAt: string): BackfillRow => ({
    id,
    title: `Story ${id}`,
    slug: `story-${id}`,
    cover_image_url: cover,
    published_at: publishedAt,
    status: "published",
    category: { slug: "markets" },
  });

  it("keeps the oldest story's cover and reassigns the rest; reassigns every legacy stock row", () => {
    const shared = "https://mmx.prnewswire.com/media/1/logo.jpg";
    const plan = planCoverReassignments([
      row("new", `${shared}?id=3`, "2026-09-24T00:00:00Z"),
      row("old", `${shared}?id=1`, "2026-09-01T00:00:00Z"),
      row("mid", `${shared}?id=2`, "2026-09-10T00:00:00Z"),
      row("sky1", SKYSCRAPER_1600, "2026-09-02T00:00:00Z"),
      row("unique", "https://image.cnbcfm.com/a.jpg", "2026-09-03T00:00:00Z"),
      row("none", "", "2026-09-04T00:00:00Z"),
    ]);
    assert.deepEqual(
      plan.map((item) => [item.row.id, item.reason, item.keeper?.id ?? null]),
      [
        ["sky1", "legacy_stock", null],
        ["mid", "duplicate", "old"],
        ["new", "duplicate", "old"],
      ],
    );
  });
});

describe("pickUniqueCover (Unsplash paging)", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function unsplashPage(ids: string[]) {
    return {
      results: ids.map((id) => ({
        id,
        alt_description: `alt ${id}`,
        urls: { raw: `https://images.unsplash.com/${id}?ixid=x` },
        links: { download_location: `https://api.unsplash.com/photos/${id}/download` },
        user: { name: "P", links: { html: "https://unsplash.com/@p" } },
      })),
    };
  }

  it("prefers an unused source image without calling Unsplash", async () => {
    globalThis.fetch = (async () => {
      throw new Error("should not be called");
    }) as typeof fetch;
    const used = new Set<string>();
    const picked = await pickUniqueCover({
      title: "Anything",
      preferred: ["https://image.cnbcfm.com/api/v1/image/x.jpg?w=1"],
      used,
      accessKey: "k",
    });
    assert.equal(picked?.source, "preferred");
    assert.ok(used.has("image.cnbcfm.com/api/v1/image/x.jpg"));
  });

  it("pages past photos other stories already use and records the pick", async () => {
    const calls: string[] = [];
    const page1 = Array.from({ length: 30 }, (_, i) => `photo-used-${i}`);
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/download")) return new Response("{}", { status: 200 });
      const page = Number(new URL(url).searchParams.get("page"));
      const body = page === 1 ? unsplashPage(page1) : unsplashPage(["photo-fresh-1", "photo-fresh-2"]);
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;

    const used = new Set(page1.map((id) => `unsplash:${id}`));
    const picked = await pickUniqueCover({
      title: "Constellation Cold Logistics Names Abhy Maharaj CEO",
      categorySlug: "leadership",
      preferred: [SKYSCRAPER_1200],
      used,
      accessKey: "k",
    });
    assert.equal(picked?.key, "unsplash:photo-fresh-1");
    assert.equal(picked?.source, "unsplash");
    assert.equal(picked?.query, "Constellation Cold Logistics logistics warehouse");
    assert.match(picked?.url ?? "", /^https:\/\/images\.unsplash\.com\/photo-fresh-1\?auto=format&fit=crop&w=1600&q=80/);
    assert.ok(used.has("unsplash:photo-fresh-1"));
    assert.equal(calls.filter((url) => url.includes("search/photos")).length, 2);
    assert.equal(calls.filter((url) => url.includes("/download")).length, 1);
  });

  it("returns null (neutral card) when nothing unused exists, and throws on rate limit", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(unsplashPage(["photo-a"])), { status: 200 })) as typeof fetch;
    const none = await pickUniqueCover({
      title: "X",
      used: new Set(["unsplash:photo-a"]),
      accessKey: "k",
      queries: ["q1", "q2"],
    });
    assert.equal(none, null);

    globalThis.fetch = (async () =>
      new Response("Rate Limit Exceeded", {
        status: 403,
        headers: { "x-ratelimit-remaining": "0" },
      })) as typeof fetch;
    await assert.rejects(
      pickUniqueCover({ title: "X", used: new Set(), accessKey: "k", queries: ["q"] }),
      UnsplashRateLimitError,
    );
  });

  it("never picks anything without an Unsplash key when sources are taken", async () => {
    const picked = await pickUniqueCover({ title: "X", preferred: [SKYSCRAPER_1600], used: new Set() });
    assert.equal(picked, null);
  });
});

describe("runCoverBackfill", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function fakeClient(rows: BackfillRow[]) {
    const updates: { values: Record<string, unknown>; id?: string; cover?: string }[] = [];
    const client = {
      from: () => ({
        select: () => ({
          order: () => ({
            range: async (from: number) => ({ data: from === 0 ? rows : [], error: null }),
          }),
        }),
        update: (values: Record<string, unknown>) => ({
          eq: (_c1: string, id: string) => ({
            eq: (_c2: string, cover: string) => ({
              select: async () => {
                updates.push({ values, id, cover });
                return { data: [{ id }], error: null };
              },
            }),
          }),
        }),
      }),
    };
    return { client, updates };
  }

  const rows: BackfillRow[] = [
    { id: "1", title: "Old Rosen story", slug: "old", cover_image_url: "https://mmx.prnewswire.com/m/logo.jpg?id=1", published_at: "2026-09-01T00:00:00Z", status: "published", category: { slug: "finance" } },
    { id: "2", title: "Rosen Law Firm opens probe into Baidu", slug: "new", cover_image_url: "https://mmx.prnewswire.com/m/logo.jpg?id=2", published_at: "2026-09-20T00:00:00Z", status: "published", category: { slug: "finance" } },
    { id: "3", title: "Retail shelf space", slug: "shelf", cover_image_url: SKYSCRAPER_1200, published_at: "2026-09-24T00:00:00Z", status: "published", category: { slug: "markets" } },
    { id: "4", title: "Draft", slug: "draft", cover_image_url: "https://images.unsplash.com/photo-draft-1", published_at: "2027-01-01T00:00:00Z", status: "draft", category: null },
  ];

  it("dry run lists what would change and writes nothing", async () => {
    const { client, updates } = fakeClient(rows);
    const report = await runCoverBackfill(client, { apply: false });
    assert.equal(report.mode, "dry-run");
    assert.equal(report.published, 3);
    assert.equal(report.toChange, 2);
    assert.deepEqual(report.changes.map((c) => [c.slug, c.reason, c.newCover]), [
      ["new", "duplicate", null],
      ["shelf", "legacy_stock", null],
    ]);
    assert.equal(updates.length, 0);
  });

  it("apply assigns unique photos, skipping ones used anywhere (drafts included)", async () => {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/download")) return new Response("{}", { status: 200 });
      return new Response(
        JSON.stringify({
          results: ["photo-draft-1", "photo-new-1", "photo-new-2"].map((id) => ({
            id,
            alt_description: null,
            urls: { raw: `https://images.unsplash.com/${id}` },
            links: {},
            user: { name: "P", links: { html: "https://unsplash.com/@p" } },
          })),
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const { client, updates } = fakeClient(rows);
    const report = await runCoverBackfill(client, { apply: true, unsplashAccessKey: "k" });
    assert.equal(report.applied, 2);
    const newCovers = updates.map((u) => String(u.values.cover_image_url));
    assert.match(newCovers[0], /photo-new-1/);
    assert.match(newCovers[1], /photo-new-2/);
    assert.deepEqual(updates.map((u) => u.id), ["2", "3"]);
    assert.equal(updates[0].cover, rows[1].cover_image_url);
  });

  it("refuses to apply without an Unsplash key", async () => {
    const { client } = fakeClient(rows);
    await assert.rejects(runCoverBackfill(client, { apply: true }), /UNSPLASH_ACCESS_KEY/);
  });
});
