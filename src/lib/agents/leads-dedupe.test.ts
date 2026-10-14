import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  articleDedupeSignals,
  isTaken,
  normalizeTitleKey,
  normalizeUrl,
  type ArticleDedupeRow,
} from "./lead-dedupe.ts";

function candidate(title: string, url: string) {
  return {
    title,
    summary: "",
    titleKey: normalizeTitleKey(title),
    normalizedUrl: normalizeUrl(url),
  };
}

function takenFromArticle(row: ArticleDedupeRow) {
  const signals = articleDedupeSignals(row);
  return {
    titleKeys: new Set([signals.titleKey]),
    urls: new Set(signals.urls),
    slugs: [signals.slug],
    recentTopics: signals.topic ? [signals.topic] : [],
  };
}

describe("article dedupe rows", () => {
  it("keeps title, slug, and a normalized canonical, and ignores other text", () => {
    const signals = articleDedupeSignals({
      title: "Oracle stock jumps on cloud outlook",
      slug: "oracle-stock-jumps-on-cloud-outlook",
      created_at: "2026-10-05T12:00:00.000Z",
      canonical_url: "https://www.cnbc.com/2026/10/05/oracle/?utm_source=tw",
    });
    assert.equal(signals.titleKey, "oracle stock jumps on cloud outlook");
    assert.equal(signals.slug, "oracle-stock-jumps-on-cloud-outlook");
    assert.deepEqual(signals.urls, ["https://cnbc.com/2026/10/05/oracle"]);
    assert.equal(signals.topic?.title, "Oracle stock jumps on cloud outlook");
    assert.equal(signals.topic?.at, Date.parse("2026-10-05T12:00:00.000Z"));
  });

  it("skips a missing or non-http canonical", () => {
    assert.deepEqual(
      articleDedupeSignals({
        title: "Fed holds rates",
        slug: "fed-holds-rates",
        created_at: "2026-10-05T12:00:00.000Z",
        canonical_url: null,
      }).urls,
      [],
    );
    assert.deepEqual(
      articleDedupeSignals({
        title: "Fed holds rates",
        slug: "fed-holds-rates",
        created_at: "not-a-date",
        canonical_url: "/fed-holds-rates",
      }).urls,
      [],
    );
  });

  it("still blocks the same title, slug prefix, or canonical URL", () => {
    const row: ArticleDedupeRow = {
      title: "Federal Reserve holds interest rates steady",
      slug: "federal-reserve-holds-interest-rates-steady",
      created_at: "2026-10-05T12:00:00.000Z",
      canonical_url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261005a.htm",
    };
    const taken = takenFromArticle(row);
    assert.equal(
      isTaken(candidate(row.title, "https://example.com/other"), taken),
      true,
    );
    assert.equal(
      isTaken(
        candidate("A different markets desk headline today", row.canonical_url ?? ""),
        taken,
      ),
      true,
    );
    assert.equal(
      isTaken(candidate("Federal Reserve holds interest", "https://example.com/fresh"), taken),
      true,
    );
  });

  it("does not treat a source URL as taken unless a narrow column has it", () => {
    const taken = takenFromArticle({
      title: "Desk note on regional banks",
      slug: "desk-note-on-regional-banks",
      created_at: "2026-10-05T12:00:00.000Z",
      canonical_url: null,
    });
    const lead = candidate(
      "Nvidia raises its data-center outlook",
      "https://www.cnbc.com/2026/10/05/nvidia-outlook.html",
    );
    assert.equal(isTaken(lead, taken), false);
    taken.urls.add(normalizeUrl(lead.normalizedUrl));
    assert.equal(isTaken(lead, taken), true);
  });

  it("selects narrow article columns and still reads processed leads and signals", () => {
    const source = readFileSync(new URL("./leads.ts", import.meta.url), "utf8");
    const load = source.slice(source.indexOf("async function loadTakenKeys"));
    const articleQuery = load.slice(0, load.indexOf('.from("processed_leads")'));
    assert.match(articleQuery, /"title, slug, canonical_url, created_at"/);
    assert.doesNotMatch(articleQuery, /\bbody\b|\bexcerpt\b/);
    assert.match(load, /\.from\("processed_leads"\)/);
    assert.match(load, /"title_key, source_url, title, created_at"/);
    assert.match(load, /\.from\("story_signals"\)/);
    assert.match(load, /"title, title_key, normalized_url, created_at"/);
    assert.doesNotMatch(source, /primary_source_urls/);
  });
});
