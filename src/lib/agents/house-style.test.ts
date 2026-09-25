import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  factCheckFailures,
  formatPublishedLine,
  weekdayForCalendarDate,
} from "./fact-check.ts";
import {
  TITLE_MAX_CHARS,
  assessWireArticle,
  headingFailures,
  isTitleCase,
  keywordSlug,
  scoreHouseStyle,
  slugShapeFailures,
  sourceAttributionFailures,
  titleFailures,
  toTitleCase,
  voiceFailures,
} from "./house-style.ts";
import { rankRelatedCandidates } from "./related-articles.ts";
import { ARTICLE_MIN_WORDS, countBodyWords, parseLeadNotes } from "./wire-hygiene.ts";

const SOURCE_URL = "https://www.cnbc.com/2026/09/17/boe.html";
const PUBLISHED = "2026-09-17T15:00:00.000Z";
const NOW = Date.parse("2026-09-17T18:00:00.000Z");

const SOURCE = `Source: CNBC
URL: ${SOURCE_URL}
Published: ${PUBLISHED}

Headline: Bank of England holds in London
Andrew Bailey said inflation is 3.1% and Bank Rate is 3.75%.`;

const TITLE = "Bank of England Holds at 3.75% After Fed Move";
const SLUG = "bank-england-holds-fed-move";

const RELATED = [
  { slug: "uk-inflation-august", title: "U.K. Inflation Rises on Energy" },
  { slug: "fed-hike-september", title: "Fed Raises Rates in September" },
];

function padParagraph(): string {
  return "<p>The committee described the same hold in plain terms and pointed readers back to the dispatch for the vote split and the inflation print already quoted above in this piece itself.</p>";
}

function cleanBody(): string {
  const pads = Array.from({ length: 16 }, () => padParagraph()).join("\n");
  return `<p>LONDON: The Bank of England kept Bank Rate at 3.75% on Thursday, Sept. 17, 2026, one day after a move by the Fed, and Andrew Bailey said inflation was 3.1%, according to a Sept. 17 report by <a href="${SOURCE_URL}">CNBC</a>.</p>
<p>The hold followed <a href="/uk-inflation-august">the August inflation print</a> and came a day after <a href="/fed-hike-september">the Fed move</a>.</p>
<h3>Bailey on the 3.1% Print</h3>
${pads}
<h3>Gilts After the Hold</h3>
<p>Bond investors took the pause as the source described it, with the same Bank Rate and the same inflation print, and they waited on the next meeting already flagged in the notes.</p>`;
}

describe("title", () => {
  it("accepts a Title Case headline of at most 60 characters", () => {
    assert.ok(TITLE.length <= TITLE_MAX_CHARS);
    assert.equal(TITLE.length, 45);
    assert.equal(isTitleCase(TITLE), true);
    assert.equal(toTitleCase(TITLE), TITLE);
    assert.deepEqual(titleFailures(TITLE), []);
  });

  it("rejects sentence case and headlines over 60 characters", () => {
    const sentence = "Bank of England leaves rates unchanged";
    assert.ok(sentence.length <= TITLE_MAX_CHARS);
    assert.equal(isTitleCase(sentence), false);
    assert.ok(titleFailures(sentence).some((failure) => /Title Case/.test(failure)));
    assert.equal(toTitleCase(sentence), "Bank of England Leaves Rates Unchanged");

    const longTitle = "Bank of England Leaves Rates Unchanged After the Federal Reserve Hike";
    assert.ok(longTitle.length > TITLE_MAX_CHARS);
    assert.ok(titleFailures(longTitle).some((failure) => /characters/.test(failure)));
  });

  it("keeps acronyms, minor words, and figures", () => {
    const headline = "AI Spending Hits $11 Billion After a Fed Hold";
    assert.equal(toTitleCase(headline.toLowerCase()), headline);
    assert.equal(toTitleCase("Bank of England Holds at 3.75% a Day After Fed Hike"), "Bank of England Holds at 3.75% a Day After Fed Hike");
  });
});

describe("slug", () => {
  it("accepts a short keyword slug and rejects a truncated headline", () => {
    assert.deepEqual(slugShapeFailures(SLUG, TITLE), []);
    assert.deepEqual(
      slugShapeFailures("bank-of-england-holds-rates-fed-hike", "Bank of England Leaves Rates Unchanged Diverging From the Federal Reserve Path"),
      [],
    );
    const truncated = "global-debt-climbs-to-365-trillion-as-interest-payments-outpace-world-spending-o";
    const failures = slugShapeFailures(
      truncated,
      "Global Debt Climbs to $365 Trillion as Interest Payments Outpace World Spending",
    );
    assert.ok(failures.some((failure) => /headline|truncated|words/i.test(failure)));
    const keyword = keywordSlug(
      "Global Debt Climbs to $365 Trillion as Interest Payments Outpace World Spending on AI",
    );
    assert.deepEqual(slugShapeFailures(keyword, "Global Debt Climbs to $365 Trillion as Interest Payments Outpace World Spending on AI"), []);
    assert.ok(keyword.split("-").length <= 8);
  });
});

describe("headings and voice", () => {
  it("rejects template headings even when the section has copy", () => {
    const html = `<p>Lede with enough reported detail to stand as a paragraph of its own in the paper.</p>
<h3>Strategic Context</h3>
<p>The notes already described the balance sheet, the rival, and the rule the company cited in the dispatch itself today.</p>
<h3>Forward Outlook</h3>
<p>Operators can watch the next filing the source already named without a fresh prediction from this desk.</p>`;
    const failures = headingFailures(html);
    assert.ok(failures.some((failure) => /Strategic Context/.test(failure)));
    assert.ok(failures.some((failure) => /story-specific/.test(failure)));
  });

  it("rejects em dashes and AI tics", () => {
    assert.ok(voiceFailures("Fine Title", "<p>Costs rose — and the landscape underscores the shift.</p>").length >= 2);
  });
});

describe("source and links", () => {
  it("requires the publication name and link in the body, not only a Source footer", () => {
    const notes = parseLeadNotes(SOURCE);
    const footer = `<p>LONDON: The bank held.</p><p>Source: <a href="${SOURCE_URL}">CNBC</a>.</p>`;
    assert.ok(sourceAttributionFailures(footer, notes).some((failure) => /source:/i.test(failure)));
    const organic = `<p>LONDON: The bank held, <a href="${SOURCE_URL}">CNBC</a> reported.</p>`;
    assert.deepEqual(sourceAttributionFailures(organic, notes), []);
  });
});

describe("fact check", () => {
  it("knows Sept. 23, 2026 was a Wednesday", () => {
    assert.equal(weekdayForCalendarDate(2026, 9, 23), "Wednesday");
    assert.equal(weekdayForCalendarDate(2026, 9, 17), "Thursday");
    assert.equal(formatPublishedLine("2026-09-23T15:00:00.000Z"), "Wednesday, Sept. 23, 2026");
  });

  it("rejects a weekday that does not match the calendar date", () => {
    const failures = factCheckFailures(
      "<p>YouTube announced the tools on Tuesday, Sept. 23, 2026.</p>",
      "TechCrunch said the Made on YouTube event was Wednesday, Sept. 23, 2026.",
      { publishedAt: "2026-09-23T15:00:00.000Z" },
      "full",
      "YouTube Ships Comments",
    );
    assert.ok(failures.some((failure) => /Wednesday/.test(failure)));
  });

  it("rejects figures and names that are not in the source", () => {
    const failures = factCheckFailures(
      "<p>Jane Doe said revenue rose 9%.</p>",
      "Source: CNBC\nThe company reported revenue.",
      { publishedAt: null },
      "full",
      "Revenue Update",
    );
    assert.ok(failures.some((failure) => /9%/.test(failure)));
    assert.ok(failures.some((failure) => /Jane Doe/.test(failure)));
  });

  it("rejects a non-English dateline when the source uses the English city", () => {
    const failures = factCheckFailures(
      "<p>Hambourg, Allemagne: The company showed the blade.</p>",
      "HAMBURG, Germany. The company showed the blade in Hamburg.",
      { publishedAt: null },
      "full",
      "Turbine Blade Shown",
    );
    assert.ok(failures.some((failure) => /Hambourg/.test(failure)));
    assert.ok(failures.some((failure) => /Allemagne/.test(failure)));
  });
});

describe("related candidates", () => {
  it("ranks stories that share topic keywords", () => {
    const ranked = rankRelatedCandidates(
      [
        { slug: "starbucks-closures", title: "Starbucks to Shutter Stores" },
        { slug: "boe-hold", title: "Bank of England Holds Rates" },
        { slug: "fed-hike", title: "Federal Reserve Raises Rates" },
      ],
      "Bank of England interest rates",
    );
    assert.equal(ranked[0]?.slug, "boe-hold");
    assert.ok(ranked.some((item) => item.slug === "fed-hike"));
    assert.equal(ranked.some((item) => item.slug === "starbucks-closures"), false);
  });
});

describe("publish gate", () => {
  it("scores a clean house-style article at 10 and blocks a thin template draft", () => {
    const notes = parseLeadNotes(SOURCE);
    const body = cleanBody();
    assert.ok(countBodyWords(body) >= ARTICLE_MIN_WORDS);
    const clean = assessWireArticle({
      title: TITLE,
      slug: SLUG,
      html: body,
      notes,
      rawSource: SOURCE,
      related: RELATED,
      now: NOW,
    });
    assert.deepEqual(clean.failures, []);
    assert.equal(clean.score, 10);

    const thin = assessWireArticle({
      title: "bank of england leaves rates unchanged after the federal reserve path widened",
      slug: "bank-of-england-leaves-rates-unchanged-after-the-federal-reserve-path-widened-again",
      html: `<p>LONDON — In a move that underscores the landscape, the bank held.</p>
<h3>Strategic Context</h3>
<p>Context.</p>
<h3>Forward Outlook</h3>
<p>Outlook.</p>`,
      notes,
      rawSource: SOURCE,
      related: RELATED,
      now: NOW,
    });
    assert.ok(thin.failures.some((failure) => failure.startsWith("too_short")));
    assert.ok(thin.failures.some((failure) => /title:/.test(failure)));
    assert.ok(thin.failures.some((failure) => /slug:/.test(failure)));
    assert.ok(thin.failures.some((failure) => /headings:/.test(failure)));
    assert.ok(thin.failures.some((failure) => /voice:/.test(failure)));
    assert.ok(thin.failures.some((failure) => /links:/.test(failure)));
    assert.ok(thin.score <= 7);
    assert.equal(scoreHouseStyle(["title: example"]), 7);
  });
});

describe("pipeline and studio wiring", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

  it("repairs once, then saves a draft instead of publishing a failed article", () => {
    const src = readFileSync(resolve(root, "src/lib/agents/pipeline.ts"), "utf8");
    assert.match(src, /repairWithEditor/);
    assert.match(src, /assessWireArticle/);
    assert.match(src, /status: "draft"/);
    assert.match(src, /REPAIR_MAX_TOKENS = 8192/);
    assert.match(src, /loadRelatedCandidates/);
  });

  it("gates a new Studio publish and leaves an already published story alone", () => {
    const src = readFileSync(resolve(root, "src/app/studio/actions.ts"), "utf8");
    assert.match(src, /studioPublishFailures/);
    assert.match(src, /existing\.status !== "published"/);
  });
});
