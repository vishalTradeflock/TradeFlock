import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { PUBLISH_SCORE_MIN, EDITOR_IN_CHIEF_PROMPT, REPAIR_PROMPT, WRITER_PROMPTS } from "./prompts.ts";
import {
  ARTICLE_MIN_WORDS,
  collapseEmptyWireSections,
  countBodyWords,
  countSubstantialParagraphs,
  hasDishonestRelativeDate,
  parseLeadNotes,
  polishWireBody,
  tooShortFailureMessage,
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
    assert.match(WRITER_PROMPTS.tech, /Title Case/);
    assert.match(WRITER_PROMPTS.tech, /60 characters/);
    assert.match(WRITER_PROMPTS.tech, /em dash/);
    assert.match(WRITER_PROMPTS.tech, /story-specific/i);
    assert.match(EDITOR_IN_CHIEF_PROMPT, /Hard fails/);
    assert.match(EDITOR_IN_CHIEF_PROMPT, /<a href>/);
    assert.match(EDITOR_IN_CHIEF_PROMPT, /Monday/);
    assert.match(EDITOR_IN_CHIEF_PROMPT, /editedSlug/);
    assert.match(REPAIR_PROMPT, /editedSlug/);
    assert.match(REPAIR_PROMPT, /internal links/i);
  });

  it("tells writer and EiC to hold thin notes instead of stubbing or padding", () => {
    assert.doesNotMatch(WRITER_PROMPTS.tech, /If the notes are thin, write fewer paragraphs rather than padding/);
    assert.doesNotMatch(EDITOR_IN_CHIEF_PROMPT, /shorter when they do not/);
    assert.match(WRITER_PROMPTS.tech, /Prefer hold over padding OR stubbing/);
    assert.match(WRITER_PROMPTS.tech, /550/);
    assert.match(EDITOR_IN_CHIEF_PROMPT, /Briefing \/ digest \/ stub length/);
    assert.match(EDITOR_IN_CHIEF_PROMPT, /HOLD the lead/);
    assert.match(EDITOR_IN_CHIEF_PROMPT, /Never use the template headings/);
    assert.match(EDITOR_IN_CHIEF_PROMPT, /Strategic Context/);
    assert.match(EDITOR_IN_CHIEF_PROMPT, /Forward Outlook/);
    assert.doesNotMatch(EDITOR_IN_CHIEF_PROMPT, /Formula-empty Strategic Context or Forward Outlook/);
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

const SEC_HREF =
  "https://www.sec.gov/newsroom/press-releases/2026-70-small-business-forums-report-congress-highlights-recommendations-improve-capital-raising-policy";

const GEMINI_STUB_BODY = `<p>MOUNTAIN VIEW — Google's Gemini broke out and hacked computer systems amid rising AI scrutiny, according to a thin wire item that named the model and little else.</p>
<h3>Strategic Context</h3>
<p>The episode lands in a broader debate over how far generative systems should be allowed to act without human approval.</p>
<h3>Forward Outlook</h3>
<p>Operators will be watching whether Google tightens safeguards. Source: <a href="${SEC_HREF}">placeholder</a>.</p>`;

function repeatGraf(sentence: string, times: number): string {
  return Array.from({ length: times }, () => `<p>${sentence}</p>`).join("\n");
}

function padToMinWords(html: string, min = ARTICLE_MIN_WORDS): string {
  const graf =
    "<p>The Commission listed capital-raising recommendations from the 45th Annual Small Business Forum, including disclosure calibration, finder exemptions, and staged offering relief that operators can take to counsel without adding unsourced claims.</p>";
  let out = html;
  for (let i = 0; i < 40 && countBodyWords(out) < min; i += 1) {
    const headingAt = out.search(/<h3\b/i);
    if (headingAt >= 0) {
      out = `${out.slice(0, headingAt)}${graf}\n${out.slice(headingAt)}`;
      continue;
    }
    if (/<p>Source:/i.test(out)) {
      out = out.replace(/<p>Source:/i, `${graf}\n<p>Source:`);
      continue;
    }
    out = `${out}\n${graf}`;
  }
  return out;
}

function forbesLengthSecBody(core: string): string {
  return padToMinWords(core);
}

describe("countBodyWords", () => {
  it("strips HTML tags and counts remaining words", () => {
    assert.equal(countBodyWords("<p>One two three</p><h3>Four</h3>"), 4);
    assert.equal(countBodyWords("<p>Hello&nbsp;world</p>"), 2);
    assert.equal(ARTICLE_MIN_WORDS, 550);
  });

  it("does not count tags as words", () => {
    assert.equal(
      countBodyWords('<p>Google <a href="https://example.com">announced</a> Gemini</p>'),
      3,
    );
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
    assert.ok(failures.some((item) => item.startsWith("too_short")));
  });

  it("holds a three-paragraph Gemini-style stub as too_short even with a source href", () => {
    const notes = parseLeadNotes(SEC_NOTES);
    const failures = wireHygieneFailures(
      GEMINI_STUB_BODY,
      notes,
      SEC_NOTES,
      Date.parse("2026-09-16T06:00:00.000Z"),
    );
    const short = failures.find((item) => item.startsWith("too_short"));
    assert.ok(short);
    assert.equal(short, tooShortFailureMessage(countBodyWords(GEMINI_STUB_BODY)));
    assert.match(short ?? "", /need ≥550/);
    assert.ok(countBodyWords(GEMINI_STUB_BODY) < ARTICLE_MIN_WORDS);
    assert.ok(countSubstantialParagraphs(GEMINI_STUB_BODY) < 5);
  });

  it("holds formula-empty Strategic Context / Forward Outlook even when the word count clears the floor", () => {
    const filler =
      "The Securities and Exchange Commission on July 27, 2026, released its report to Congress on the 45th Annual Small Business Forum, listing capital-raising recommendations for small issuers that operators can take to counsel.";
    const body = padToMinWords(`${repeatGraf(filler, 8)}
<h3>Strategic Context</h3>
<p>The news sits against a broader backdrop.</p>
<h3>Forward Outlook</h3>
<p>Operators will be watching.</p>
<p>Source: <a href="${SEC_HREF}">SEC release 2026-70</a>.</p>`);
    assert.ok(countBodyWords(body) >= ARTICLE_MIN_WORDS);
    const notes = parseLeadNotes(SEC_NOTES);
    const failures = wireHygieneFailures(body, notes, SEC_NOTES, Date.parse("2026-09-16T06:00:00.000Z"));
    assert.ok(failures.some((item) => /formula-empty Strategic Context \/ Forward Outlook/i.test(item)));
  });

  it("passes a reported-news draft with a source link, the real date, and Forbes length", () => {
    const body = forbesLengthSecBody(`<p>WASHINGTON — The Securities and Exchange Commission on July 27, 2026, released its report to Congress on the 45th Annual Small Business Forum, listing capital-raising recommendations from the March 9, 2026, gathering.</p>
<h3>Strategic Context</h3>
<p>The forum report sits in a multi-year SEC effort to ease capital formation for smaller issuers without dropping investor protections, a tension the Commission has described in prior small-business forum write-ups.</p>
<h3>Forward Outlook</h3>
<p>The Commission said it will consider the recommendations alongside other public comments as staff weigh disclosure calibration and finder exemptions that operators can take to counsel.</p>
<p>Source: <a href="${SEC_HREF}">SEC release 2026-70</a>.</p>`);
    const notes = parseLeadNotes(SEC_NOTES);
    assert.ok(countBodyWords(body) >= ARTICLE_MIN_WORDS);
    assert.ok(countSubstantialParagraphs(body) >= 5);
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

describe("pipeline writer capacity", () => {
  it("raises writer maxTokens above 2048 so a 600–800 word draft is not truncated", () => {
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "pipeline.ts"),
      "utf8",
    );
    assert.match(src, /WRITER_MAX_TOKENS = 4096/);
    assert.match(src, /EDITOR_MAX_TOKENS = 8192/);
    assert.doesNotMatch(src, /maxTokens:\s*2048/);
  });
});

describe("unpublish-wire-stubs script", () => {
  it("targets the Gemini stub slug and reads Supabase env like other scripts", () => {
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "../../../scripts/unpublish-wire-stubs.ts"),
      "utf8",
    );
    assert.match(
      src,
      /google-s-gemini-breaks-out-and-hacks-computer-systems-amid-rising-ai-scrutiny/,
    );
    assert.match(src, /NEXT_PUBLIC_SUPABASE_URL/);
    assert.match(src, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.match(src, /status: "draft"/);
    assert.match(src, /ARTICLE_MIN_WORDS/);
  });
});
