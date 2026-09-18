import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { PUBLISH_SCORE_MIN, EDITOR_IN_CHIEF_PROMPT, WRITER_PROMPTS } from "./prompts.ts";
import {
  collapseEmptyWireSections,
  hasDishonestRelativeDate,
  parseLeadNotes,
  polishWireBody,
  wireHygieneFailures,
} from "./wire-hygiene.ts";

const BENIOFF_NOTES = `Source: CNBC Technology
URL: https://www.cnbc.com/2026/09/15/salesforce-marc-benioff-ai-risks.html
Published: 2026-09-15T22:31:00.000Z

Headline: Salesforce CEO Marc Benioff joins growing chorus of tech leaders warning about AI risks

Summary:
Salesforce CEO Marc Benioff warned the industry to act responsibly. "A lot of companies got hurt, a lot of individuals got hurt through social media," Benioff told Jim Cramer.`;

const SEC_NOTES = `Source: SEC Press Releases
URL: https://www.sec.gov/newsroom/press-releases/2026-70-small-business-forums-report-congress-highlights-recommendations-improve-capital-raising-policy
Published: 2026-07-27T14:00:00.000Z

Headline: Small Business Forum’s Report to Congress Highlights Recommendations to Improve Capital-Raising Policy`;

describe("publish bar", () => {
  it("keeps PUBLISH_SCORE_MIN at 8.5", () => {
    assert.equal(PUBLISH_SCORE_MIN, 8.5);
  });

  it("tells the writer and editor to require a source href and ban market briefs", () => {
    assert.match(WRITER_PROMPTS.tech, /In-body source link/);
    assert.match(WRITER_PROMPTS.tech, /market brief/);
    assert.match(EDITOR_IN_CHIEF_PROMPT, /Hard fails/);
    assert.match(EDITOR_IN_CHIEF_PROMPT, /<a href>/);
    assert.match(EDITOR_IN_CHIEF_PROMPT, /Monday/);
  });
});

describe("parseLeadNotes", () => {
  it("reads URL, Published, and Cover lines", () => {
    const notes = parseLeadNotes(`${BENIOFF_NOTES}\nCover: https://image.cnbcfm.com/benioff.jpg\n`);
    assert.equal(notes.sourceUrl, "https://www.cnbc.com/2026/09/15/salesforce-marc-benioff-ai-risks.html");
    assert.equal(notes.publishedAt, "2026-09-15T22:31:00.000Z");
    assert.equal(notes.coverUrl, "https://image.cnbcfm.com/benioff.jpg");
  });

  it("sanitizes a double-encoded Cover URL from the lead notes", () => {
    const notes = parseLeadNotes(
      `${BENIOFF_NOTES}\nCover: https://image.cnbcfm.com/benioff.jpg?v=1&amp;amp;w=1600\n`,
    );
    assert.equal(notes.coverUrl, "https://image.cnbcfm.com/benioff.jpg?v=1&w=1600");
  });
});

describe("ensureSourceLink", () => {
  it("appends a Source line when the href is missing", () => {
    const html = polishWireBody(
      `<p>SAN FRANCISCO — Marc Benioff warned AI companies not to repeat social media's harms.</p>
<h3>Forward Outlook</h3>
<p>Watch whether other CEOs echo the same caution.</p>`,
      parseLeadNotes(BENIOFF_NOTES),
    );
    assert.match(
      html,
      /<a href="https:\/\/www\.cnbc\.com\/2026\/09\/15\/salesforce-marc-benioff-ai-risks\.html">/,
    );
  });
});

describe("collapseEmptyWireSections", () => {
  it("drops an Industry section that admits there are no analysts", () => {
    const html = collapseEmptyWireSections(`<p>Lede.</p>
<h3>Industry & Analyst Perspectives</h3>
<p>While CNBC did not cite specific financial analysts, industry observers note that buyers want guardrails.</p>
<h3>Forward Outlook</h3>
<p>Watch the next earnings call.</p>`);
    assert.doesNotMatch(html, /Industry & Analyst/);
    assert.match(html, /Forward Outlook/);
  });
});

describe("wireHygieneFailures", () => {
  it("holds a market-brief with invented Monday urgency and no source href", () => {
    const body = `<p>WASHINGTON — The SEC published its report to Congress on Monday, aligning capital-raising policy with a growing caution over runaway deployment risks.</p>
<h3>Industry & Analyst Perspectives</h3>
<p>Industry observers note that legislative observers await follow-through.</p>
<h3>Financial & Macro Implications</h3>
<p>For CFOs, return on investment timelines will slip and sales cycles for AI features could lengthen.</p>`;
    const notes = parseLeadNotes(SEC_NOTES);
    const failures = wireHygieneFailures(body, notes, SEC_NOTES, Date.parse("2026-09-16T06:00:00.000Z"));
    assert.ok(failures.some((item) => /source URL/i.test(item)));
    assert.ok(failures.some((item) => /dateline/i.test(item)));
    assert.ok(failures.some((item) => /observers/i.test(item)));
    assert.ok(failures.some((item) => /allocator/i.test(item)));
    assert.ok(failures.some((item) => /market-brief/i.test(item)));
  });

  it("passes a reported-news draft with a source link and the real date", () => {
    const body = `<p>WASHINGTON — The Securities and Exchange Commission on July 27, 2026, released its report to Congress on the 45th Annual Small Business Forum.</p>
<h3>Forward Outlook</h3>
<p>The Commission said it will consider the recommendations alongside other public comments.</p>
<p>Source: <a href="https://www.sec.gov/newsroom/press-releases/2026-70-small-business-forums-report-congress-highlights-recommendations-improve-capital-raising-policy">SEC release 2026-70</a>.</p>`;
    const notes = parseLeadNotes(SEC_NOTES);
    assert.deepEqual(
      wireHygieneFailures(body, notes, SEC_NOTES, Date.parse("2026-09-16T06:00:00.000Z")),
      [],
    );
  });
});

describe("polishWireBody", () => {
  it("converts markdown Forward Outlook into an h3", () => {
    const html = polishWireBody(
      `<p>Lede with <a href="https://www.cnbc.com/2026/09/15/salesforce-marc-benioff-ai-risks.html">CNBC</a>.</p>\n## Forward Outlook\n<p>Watch the next keynote.</p>`,
      parseLeadNotes(BENIOFF_NOTES),
    );
    assert.match(html, /<h3>Forward Outlook<\/h3>/);
    assert.doesNotMatch(html, /## Forward Outlook/);
  });
});

describe("hasDishonestRelativeDate", () => {
  it("flags Monday urgency on a July release when the notes do not say Monday", () => {
    assert.equal(
      hasDishonestRelativeDate(
        "<p>The SEC published its report to Congress on Monday.</p>",
        "2026-07-27T14:00:00.000Z",
        SEC_NOTES,
        Date.parse("2026-09-16T06:00:00.000Z"),
      ),
      true,
    );
  });
});

describe("corrected story files", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../scripts/story-fixes");

  it("Benioff rewrite has a CNBC href, Dreamforce/Mad Money, a quote, and no allocator speculation", () => {
    const html = readFileSync(
      resolve(root, "salesforce-ceo-marc-benioff-warns-of-ai-risks-as-enterprise-software-dep-mu39m09z.html"),
      "utf8",
    );
    assert.match(html, /<h3>Forward Outlook<\/h3>/);
    assert.match(html, /Dreamforce/);
    assert.match(html, /Mad Money/);
    assert.match(html, /Jim Cramer/);
    assert.match(html, /stopped short/);
    assert.match(
      html,
      /href="https:\/\/www\.cnbc\.com\/2026\/09\/15\/salesforce-marc-benioff-ai-risks\.html"/,
    );
    assert.doesNotMatch(html, /sales cycles? for .+could lengthen/i);
    const notes = parseLeadNotes(BENIOFF_NOTES);
    assert.deepEqual(wireHygieneFailures(html, notes, BENIOFF_NOTES, Date.parse("2026-09-16T06:00:00.000Z")), []);
  });

  it("SEC rewrite uses July 27, 2026 and March 9, 2026 with an in-body SEC link", () => {
    const html = readFileSync(
      resolve(root, "sec-publishes-45th-annual-small-business-forum-report-to-congress-on-cap-mu39lv0w.html"),
      "utf8",
    );
    assert.match(html, /July 27, 2026/);
    assert.match(html, /March 9, 2026/);
    assert.match(html, /2026-70/);
    assert.match(html, /Early-Stage Capital Raising/);
    assert.match(
      html,
      /href="https:\/\/www\.sec\.gov\/newsroom\/press-releases\/2026-70-small-business-forums-report-congress-highlights-recommendations-improve-capital-raising-policy"/,
    );
    assert.doesNotMatch(html, /published its report to Congress on Monday/);
    const notes = parseLeadNotes(SEC_NOTES);
    assert.deepEqual(wireHygieneFailures(html, notes, SEC_NOTES, Date.parse("2026-09-16T06:00:00.000Z")), []);
  });
});
