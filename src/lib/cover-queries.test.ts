/**
 * Cover queries must never send a person's name to Unsplash.
 *
 * Company vs person heuristic (see the comment on buildCoverSearchQueries):
 * a known company/ticker allowlist, a capitalized run next to a corporate
 * suffix, or the leading run before an appointment verb is a company and is
 * kept. Other multi-word capitalized runs, honorifics, initials, and an
 * explicit person-name field are people and are dropped. A single leftover
 * capitalized token is kept, because in a news headline it is usually a
 * company that is not on the list.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { runCoverBackfill, type BackfillRow } from "./cover-backfill.ts";
import {
  buildCoverSearchQueries,
  GENERIC_COVER_LADDER,
  isCoverKeyTaken,
  MAX_COVER_SEARCHES_PER_STORY,
  NAME_QUERY_PHOTO_IDS,
  NAME_QUERY_REDO_SLUGS,
  needsNameQueryRedo,
  planCoverSearchAttempts,
  planNameQueryRedos,
} from "./cover-dedupe.ts";
import { pickUniqueCover } from "./cover-picker.ts";

function assertNoNames(queries: readonly string[], names: readonly string[]) {
  const blob = queries.join("\n");
  for (const name of names) {
    assert.doesNotMatch(blob, new RegExp(`\\b${name}\\b`, "i"), `query contained "${name}":\n${blob}`);
  }
}

describe("buildCoverSearchQueries — person names", () => {
  it("puts no name tokens in queries for a pure-name title", () => {
    for (const title of ["Tom Cyriac", "Jennifer Holmgren", "Pawel Swiatek", "Pua Seck Guan", "Juan Ignacio Rubiolo"]) {
      const queries = buildCoverSearchQueries(title, "success-insights");
      assert.ok(queries.length > 0, title);
      assertNoNames(
        queries,
        title
          .toLowerCase()
          .split(/\s+/)
          .filter((word) => word.length > 1),
      );
      assert.ok(
        queries.some((query) => GENERIC_COVER_LADDER.some((scene) => query.toLowerCase() === scene)),
        `${title} should fall back to a non-person scene`,
      );
    }
  });

  it("drops Henry and Nkumbe from 'Dr Henry Nkumbe Visionary'", () => {
    const queries = buildCoverSearchQueries("Dr Henry Nkumbe Visionary", "leadership", {
      slug: "dr-henry-nkumbe-visionary-ceos-to-watch-in-2026",
    });
    assertNoNames(queries, ["dr", "henry", "nkumbe"]);
    assert.ok(queries.some((query) => /visionary ceos/i.test(query)));
    assert.ok(queries.some((query) => /modern office|boardroom|city skyline at dusk/i.test(query)));
    assert.ok(!queries.some((query) => /business leader/i.test(query)));
  });

  it("keeps Nvidia, Microsoft, and BlackRock in a normal news headline", () => {
    const queries = buildCoverSearchQueries(
      "Nvidia and Microsoft extend a rally as BlackRock lifts its target",
      "markets",
    );
    const blob = queries.join(" \n ");
    assert.match(blob, /\bNvidia\b/);
    assert.match(blob, /\bmicrosoft\b/i);
    assert.match(blob, /\bblackrock\b/i);
    assert.ok(!queries.some((query) => /business leader/i.test(query)));
  });

  it("keeps a company next to a corporate suffix and drops the person hired", () => {
    const queries = buildCoverSearchQueries("Acme Logistics Names Jane Doe CEO", "leadership");
    assert.match(queries[0], /^Acme Logistics\b/);
    assertNoNames(queries, ["jane", "doe"]);
  });

  it("keeps a multi-word company on the phrase list and drops the appointee", () => {
    const queries = buildCoverSearchQueries("Goldman Sachs Names Jane Doe CFO", "finance");
    assert.ok(queries.some((query) => /Goldman Sachs/.test(query)));
    assertNoNames(queries, ["jane", "doe"]);
  });

  it("strips an explicit person-name field even when it is not capitalized in the headline", () => {
    const queries = buildCoverSearchQueries("Profile of tom cyriac in the supply chain", "leadership", {
      personName: "Tom Cyriac",
    });
    assertNoNames(queries, ["tom", "cyriac"]);
    assert.ok(queries.some((query) => /logistics|supply|warehouse/i.test(query)));
  });

  it("uses the list theme and non-portrait scenes for a Success Insights slug", () => {
    const queries = buildCoverSearchQueries("Tom Cyriac", "leadership", {
      slug: "tom-cyriac-most-innovative-global-coos-2026",
    });
    assertNoNames(queries, ["tom", "cyriac"]);
    assert.ok(queries.some((query) => /global COOs/.test(query)));
    assert.ok(queries[0]?.toLowerCase().includes("modern office") || /global coos/i.test(queries[0] ?? ""));
  });

  it("does not search 'business leader' plus a given name for a profile on the leadership desk", () => {
    const queries = buildCoverSearchQueries("Joseph Frankie", "leadership", {
      slug: "joseph-frankie-visionary-ceos-to-watch-in-2026",
    });
    assertNoNames(queries, ["joseph", "frankie"]);
    assert.ok(!queries.some((query) => /business leader/i.test(query)));
  });
});

describe("planCoverSearchAttempts", () => {
  it("tries three queries before the next page or the generic ladder, and caps the list", () => {
    const attempts = planCoverSearchAttempts(["alpha", "beta", "gamma", "delta", "epsilon"]);
    assert.equal(attempts.length, MAX_COVER_SEARCHES_PER_STORY);
    assert.deepEqual(
      attempts.map((attempt) => [attempt.query, attempt.page]),
      [
        ["alpha", 1],
        ["beta", 1],
        ["gamma", 1],
        ["alpha", 2],
        [GENERIC_COVER_LADDER[0], 1],
      ],
    );
  });
});

describe("name-query redo set", () => {
  const bad = `https://images.unsplash.com/photo-${NAME_QUERY_PHOTO_IDS[0].replace(/^photo-/, "")}?w=1600`;

  it("redoes a listed slug only while it still wears one of the old photos", () => {
    const slug = NAME_QUERY_REDO_SLUGS[0];
    assert.equal(needsNameQueryRedo({ slug, cover_image_url: bad }), true);
    assert.equal(
      needsNameQueryRedo({
        slug,
        cover_image_url: "https://images.unsplash.com/photo-not-from-that-run?w=1600",
      }),
      false,
    );
    assert.equal(needsNameQueryRedo({ slug: "some-other-story", cover_image_url: bad }), false);
    assert.equal(isCoverKeyTaken(`unsplash:${NAME_QUERY_PHOTO_IDS[0]}`, new Set()), true);
  });

  it("plans those slugs first and skips them once the cover id has changed", () => {
    const slug = "tom-cyriac-most-innovative-global-coos-2026";
    const row = {
      id: "tom",
      title: "Tom Cyriac",
      slug,
      cover_image_url: bad,
      published_at: "2026-09-20T00:00:00Z",
    };
    assert.equal(planNameQueryRedos([row])[0]?.row.id, "tom");
    assert.deepEqual(planNameQueryRedos([{ ...row, cover_image_url: "https://images.unsplash.com/photo-fresh-office" }]), []);
  });
});

describe("pickUniqueCover search budget and portraits", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function photo(id: string, alt: string) {
    return {
      id,
      alt_description: alt,
      description: null,
      urls: { raw: `https://images.unsplash.com/${id}` },
      links: { download_location: `https://api.unsplash.com/photos/${id}/download` },
      user: { name: "P", links: { html: "https://unsplash.com/@p" } },
    };
  }

  it("stops after three queries, one next page, and one ladder query", async () => {
    const calls: string[] = [];
    const taken = Array.from({ length: 30 }, (_, index) => `photo-cap-${index}`);
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/download")) return new Response("{}", { status: 200 });
      calls.push(url);
      const page = Number(new URL(url).searchParams.get("page"));
      const ids = page === 1 ? taken : taken;
      return new Response(JSON.stringify({ results: ids.map((id) => photo(id, "office")) }), { status: 200 });
    }) as typeof fetch;

    const used = new Set(taken.map((id) => `unsplash:${id}`));
    const picked = await pickUniqueCover({
      title: "Ignored",
      used,
      accessKey: "k",
      queries: ["alpha", "beta", "gamma", "delta", "epsilon", "zeta"],
    });
    assert.equal(picked, null);
    const searches = calls.filter((url) => url.includes("search/photos"));
    assert.equal(searches.length, MAX_COVER_SEARCHES_PER_STORY);
    const parsed = searches.map((url) => {
      const params = new URL(url).searchParams;
      return [params.get("query"), params.get("page")];
    });
    assert.deepEqual(parsed, [
      ["alpha", "1"],
      ["beta", "1"],
      ["gamma", "1"],
      ["alpha", "2"],
      ["modern office", "1"],
    ]);
  });

  it("skips portrait hits for a profile and never queries the person's name", async () => {
    const queries: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/download")) return new Response("{}", { status: 200 });
      queries.push(new URL(url).searchParams.get("query") ?? "");
      return new Response(
        JSON.stringify({
          results: [
            photo("photo-face", "portrait of a smiling man in a suit"),
            photo("photo-office", "empty boardroom with a long table"),
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const picked = await pickUniqueCover({
      title: "Tom Cyriac",
      categorySlug: "success-insights",
      slug: "tom-cyriac-most-innovative-global-coos-2026",
      used: new Set(),
      accessKey: "k",
    });
    assert.equal(picked?.key, "unsplash:photo-office");
    assertNoNames(queries, ["tom", "cyriac"]);
  });
});

describe("runCoverBackfill name-query redo", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const shared = "https://mmx.prnewswire.com/media/shared/logo.jpg";
  const bad = `https://images.unsplash.com/${NAME_QUERY_PHOTO_IDS[5]}?auto=format&fit=crop&w=1600&q=80`;

  const rows: BackfillRow[] = [
    {
      id: "old",
      title: "Older market story",
      slug: "older-market-story",
      cover_image_url: `${shared}?id=1`,
      published_at: "2026-09-01T00:00:00Z",
      status: "published",
      category: { slug: "markets" },
    },
    {
      id: "new",
      title: "Newer market story",
      slug: "newer-market-story",
      cover_image_url: `${shared}?id=2`,
      published_at: "2026-09-20T00:00:00Z",
      status: "published",
      category: { slug: "markets" },
    },
    {
      id: "tom",
      title: "Tom Cyriac",
      slug: "tom-cyriac-most-innovative-global-coos-2026",
      cover_image_url: bad,
      published_at: "2026-09-18T00:00:00Z",
      status: "published",
      category: { slug: "success-insights" },
      company: "Cold Chain Partners",
    },
  ];

  function fakeClient(input: BackfillRow[]) {
    const updates: { id?: string; cover?: string }[] = [];
    const client = {
      from: () => ({
        select: () => ({
          order: () => ({
            range: async (from: number) => ({ data: from === 0 ? input : [], error: null }),
          }),
        }),
        update: (values: Record<string, unknown>) => ({
          eq: (_column: string, id: string) => ({
            eq: (_column2: string, cover: string) => ({
              select: async () => {
                updates.push({ id, cover });
                const row = input.find((item) => item.id === id);
                if (row) row.cover_image_url = String(values.cover_image_url ?? "");
                return { data: [{ id }], error: null };
              },
            }),
          }),
        }),
      }),
    };
    return { client, updates };
  }

  it("processes the redo set before duplicates and does not search the person's name", async () => {
    const { client, updates } = fakeClient(rows.map((row) => ({ ...row })));
    const dry = await runCoverBackfill(client, { apply: false, redoNameQueries: true });
    assert.equal(dry.nameQueryRedos, 1);
    assert.deepEqual(
      dry.changes.map((change) => [change.slug, change.reason]),
      [
        ["tom-cyriac-most-innovative-global-coos-2026", "name_query"],
        ["newer-market-story", "duplicate"],
      ],
    );
    assertNoNames(dry.changes[0].queries, ["tom", "cyriac"]);
    assert.ok(dry.changes[0].queries.some((query) => /cold chain|logistics|headquarters|modern office/i.test(query)));
    assert.equal(updates.length, 0);
  });

  it("apply re-picks the profile once, then leaves it alone", async () => {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/download")) return new Response("{}", { status: 200 });
      return new Response(
        JSON.stringify({
          results: ["photo-office-a", "photo-office-b", "photo-office-c"].map((id) => photoLite(id)),
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const live = rows.map((row) => ({ ...row }));
    const { client, updates } = fakeClient(live);
    const first = await runCoverBackfill(client, {
      apply: true,
      unsplashAccessKey: "k",
      redoNameQueries: true,
      limit: 1,
    });
    assert.equal(first.applied, 1);
    assert.equal(first.changes[0]?.slug, "tom-cyriac-most-innovative-global-coos-2026");
    assert.match(String(updates[0]?.cover), new RegExp(NAME_QUERY_PHOTO_IDS[5]));
    assert.equal(needsNameQueryRedo(live[2]), false);

    const second = await runCoverBackfill(client, { apply: false, redoNameQueries: true });
    assert.equal(second.nameQueryRedos, 0);
    assert.ok(!second.changes.some((change) => change.reason === "name_query"));
  });
});

function photoLite(id: string) {
  return {
    id,
    alt_description: "glass office interior",
    urls: { raw: `https://images.unsplash.com/${id}` },
    links: {},
    user: { name: "P", links: { html: "https://unsplash.com/@p" } },
  };
}
