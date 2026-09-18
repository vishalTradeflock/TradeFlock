import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countRealParagraphs,
  isShortProfileBlurb,
  isSuccessInsightsArticle,
  looksLikeSuccessInsightsListicle,
  partitionHomeArticles,
  shouldRecategorizeToSuccessInsights,
  shouldUnpublishSiBlurb,
  stripHtmlToText,
  withoutSuccessInsights,
} from "./success-insights.ts";

const siCategory = { slug: "success-insights", name: "Success Insights" };
const leadership = { slug: "leadership", name: "Leadership" };
const markets = { slug: "markets", name: "Markets" };

describe("looksLikeSuccessInsightsListicle", () => {
  it("matches the imported Visionary CEOs to Watch blurb", () => {
    assert.equal(
      looksLikeSuccessInsightsListicle(
        "Norliana Aida Ramli: Visionary CEOs to Watch in 2026",
        "norliana-aida-ramli-visionary-ceos-to-watch-in-2026",
      ),
      true,
    );
  });

  it("matches other WordPress SI series fragments", () => {
    assert.equal(
      looksLikeSuccessInsightsListicle(
        "Empowering Women Leaders",
        "jane-doe-empowering-women-leaders-2026",
      ),
      true,
    );
    assert.equal(
      looksLikeSuccessInsightsListicle(
        "Entrepreneurs to Watch",
        "founder-entrepreneurs-to-watch-in-2026",
      ),
      true,
    );
    assert.equal(
      looksLikeSuccessInsightsListicle(
        "Innovative Global COOs",
        "alex-innovative-global-coos",
      ),
      true,
    );
  });

  it("does not treat ordinary news headlines as SI listicles", () => {
    assert.equal(
      looksLikeSuccessInsightsListicle(
        "Why Fortune 500 boards are splitting the chair and CEO roles — again",
        "fortune-500-boards-split-chair-ceo",
      ),
      false,
    );
    assert.equal(
      looksLikeSuccessInsightsListicle(
        "Treasury yields climb as traders price a slower path to rate cuts into year-end",
        "treasury-yields-climb-slower-rate-cuts",
      ),
      false,
    );
  });
});

describe("isSuccessInsightsArticle", () => {
  it("treats the SI category as SI even without a listicle title", () => {
    assert.equal(
      isSuccessInsightsArticle({
        category: siCategory,
        title: "How a Midwest manufacturer rebuilt its operating cadence",
        slug: "midwest-manufacturer-operating-cadence",
      }),
      true,
    );
  });

  it("treats a leadership-desk listicle as SI so it cannot leak onto news rails", () => {
    assert.equal(
      isSuccessInsightsArticle({
        category: leadership,
        title: "Norliana Aida Ramli: Visionary CEOs to Watch in 2026",
        slug: "norliana-aida-ramli-visionary-ceos-to-watch-in-2026",
      }),
      true,
    );
  });
});

describe("withoutSuccessInsights / partitionHomeArticles", () => {
  it("keeps news on editorial rails and SI out of the pool", () => {
    const news = {
      id: "1",
      category: markets,
      title: "Oil holds near $82 as OPEC+ discipline collides with soft China demand",
      slug: "oil-holds-82-opec-china-demand",
    };
    const blurb = {
      id: "2",
      category: leadership,
      title: "Norliana Aida Ramli: Visionary CEOs to Watch in 2026",
      slug: "norliana-aida-ramli-visionary-ceos-to-watch-in-2026",
    };
    const interview = {
      id: "3",
      category: siCategory,
      title: "A conversation with a Midwest operator",
      slug: "midwest-operator-conversation",
    };

    const filtered = withoutSuccessInsights([news, blurb, interview]);
    assert.deepEqual(
      filtered.map((row) => row.id),
      ["1"],
    );

    const { editorialArticles, successInsightsArticles } = partitionHomeArticles([
      news,
      blurb,
      interview,
    ]);
    assert.deepEqual(
      editorialArticles.map((row) => row.id),
      ["1"],
    );
    assert.deepEqual(
      successInsightsArticles.map((row) => row.id),
      ["2", "3"],
    );
  });
});

describe("isShortProfileBlurb", () => {
  it("flags a two-sentence bio after stripping tags", () => {
    const body =
      "<p>Norliana Aida Ramli is a visionary CEO recognized for transforming her organization through inclusive leadership and a steadfast commitment to innovation.</p>";
    assert.equal(stripHtmlToText(body).length < 1000, true);
    assert.equal(countRealParagraphs(body), 1);
    assert.equal(isShortProfileBlurb(body), true);
  });

  it("keeps a reported story with three substantial paragraphs", () => {
    const body = `<p>${"The board split the chair and CEO roles after a year of investor pressure from large index holders who wanted clearer accountability at the top. ".repeat(4)}</p>
<p>${"Directors said the search for an independent chair would run alongside the current chief's remaining term, a sequence several advisers called unusual but workable. ".repeat(4)}</p>
<p>${"Compensation consultants noted that splitting the jobs rarely cuts pay in the first year; the tell is whether the new chair gets a real mandate over the agenda. ".repeat(4)}</p>`;
    assert.equal(countRealParagraphs(body) >= 3, true);
    assert.ok(stripHtmlToText(body).length >= 1000);
    assert.equal(isShortProfileBlurb(body), false);
  });
});

describe("shouldUnpublishSiBlurb / shouldRecategorizeToSuccessInsights", () => {
  it("unpublishes a short leadership-categorized to-watch blurb and recategorizes it", () => {
    const article = {
      category: leadership,
      title: "Norliana Aida Ramli: Visionary CEOs to Watch in 2026",
      slug: "norliana-aida-ramli-visionary-ceos-to-watch-in-2026",
      body: "<p>A one-paragraph bio imported from WordPress.</p>",
    };
    assert.equal(shouldUnpublishSiBlurb(article), true);
    assert.equal(shouldRecategorizeToSuccessInsights(article), true);
  });

  it("does not unpublish a long SI interview, and does not recategorize news", () => {
    const interview = {
      category: siCategory,
      title: "How a Midwest manufacturer rebuilt its operating cadence",
      slug: "midwest-manufacturer-operating-cadence",
      body: `<p>${"Operators in Dayton spent eighteen months ripping out a scheduling stack that could not see second-shift capacity. ".repeat(4)}</p>
<p>${"The new cadence is a Monday packet: overdue orders, scrap, and the two machines most likely to stop the line. ".repeat(4)}</p>
<p>${"Finance signed off after the plant cut expedite freight by a third, a number the controller could defend in the monthly review. ".repeat(4)}</p>`,
    };
    assert.equal(shouldUnpublishSiBlurb(interview), false);
    assert.equal(shouldRecategorizeToSuccessInsights(interview), false);

    const news = {
      category: markets,
      title: "Oil holds near $82 as OPEC+ discipline collides with soft China demand",
      slug: "oil-holds-82-opec-china-demand",
      body: "<p>Short wire.</p>",
    };
    assert.equal(shouldUnpublishSiBlurb(news), false);
    assert.equal(shouldRecategorizeToSuccessInsights(news), false);
  });
});
