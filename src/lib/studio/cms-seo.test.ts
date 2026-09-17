import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { faqAnswerPlainText, prepareStudioFaqs, sanitizeFaqAnswer } from "./faqs.ts";
import { sanitizeAltText, sanitizeBio, sanitizeVerificationToken } from "./head-meta.ts";
import { isValidPublicSlug, sanitizeSlug, slugFromTitle } from "./slug.ts";

describe("sanitizeSlug", () => {
  it("builds a URL-safe slug from a headline", () => {
    assert.equal(sanitizeSlug("Apple Announces New AI Strategy"), "apple-announces-new-ai-strategy");
    assert.equal(isValidPublicSlug("apple-announces-new-ai-strategy"), true);
  });

  it("does not append a timestamp", () => {
    const slug = slugFromTitle("Desk Note");
    assert.equal(slug, "desk-note");
    assert.equal(/\d/.test(slug), false);
  });

  it("rejects empty or unsafe values", () => {
    assert.equal(sanitizeSlug("@@@"), "");
    assert.equal(isValidPublicSlug(""), false);
    assert.equal(isValidPublicSlug("Hello World"), false);
  });
});

describe("prepareStudioFaqs", () => {
  it("drops empty rows and sanitizes answers", () => {
    const result = prepareStudioFaqs([
      { question: "", answer: "" },
      {
        question: "What changed?",
        answer: '<p>The board voted</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>',
      },
    ]);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.faqs.length, 1);
    assert.equal(result.faqs[0].question, "What changed?");
    assert.equal(result.faqs[0].answer.includes("script"), false);
    assert.equal(result.faqs[0].answer.includes("javascript"), false);
  });

  it("skips incomplete pairs rather than storing them", () => {
    const result = prepareStudioFaqs([{ question: "Only a question?", answer: "  " }]);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.faqs, []);
  });
});

describe("faqAnswerPlainText", () => {
  it("strips tags for JSON-LD", () => {
    assert.equal(faqAnswerPlainText("<p>The <strong>Fed</strong> held rates.</p>"), "The Fed held rates.");
  });
});

describe("sanitizeFaqAnswer", () => {
  it("keeps simple formatting", () => {
    const html = sanitizeFaqAnswer("<p>See <a href=\"https://www.tradeflock.net/news/x\">the story</a>.</p>");
    assert.match(html, /<a href="https:\/\/www.tradeflock.net\/news\/x">/);
  });
});

describe("head meta sanitizers", () => {
  it("accepts a Google token and a meta tag paste", () => {
    assert.equal(sanitizeVerificationToken("abcDEF123_-xyz"), "abcDEF123_-xyz");
    assert.equal(
      sanitizeVerificationToken('<meta name="google-site-verification" content="abcDEF123_-xyz" />'),
      "abcDEF123_-xyz",
    );
    assert.equal(sanitizeVerificationToken("<script>alert(1)</script>"), null);
  });

  it("does not invent alt text or bios", () => {
    assert.equal(sanitizeAltText("  "), "");
    assert.equal(sanitizeAltText("<b>Apple CEO speaking</b>").includes("<"), false);
    assert.equal(sanitizeBio("<p>Covers markets.</p>"), "Covers markets.");
  });
});
