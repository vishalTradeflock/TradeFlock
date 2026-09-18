import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  repairInlineAnchors,
  sanitizeArticleBody,
} from "./sanitize-article-body.ts";

describe("repairInlineAnchors", () => {
  it("collapses newlines adjacent to anchors", () => {
    const html = `<p>According to\n<a href="/x">Jane Doe</a>\n's report.</p>`;
    assert.equal(
      repairInlineAnchors(html),
      `<p>According to <a href="/x">Jane Doe</a>'s report.</p>`,
    );
  });

  it("unwraps a standalone link paragraph between sentence fragments", () => {
    const html =
      `<p>According to</p><p><a href="/x">Jane Doe</a></p><p>'s report said more.</p>`;
    assert.equal(
      repairInlineAnchors(html),
      `<p>According to <a href="/x">Jane Doe</a>'s report said more.</p>`,
    );
  });

  it("strips block/flex classes from anchors", () => {
    const html = `<p>See <a class="btn block flex" href="/x">Jane</a>, next.</p>`;
    assert.equal(
      repairInlineAnchors(html),
      `<p>See <a class="btn" href="/x">Jane</a>, next.</p>`,
    );
  });
});

describe("sanitizeArticleBody", () => {
  it("repairs split links after stripping styles", () => {
    const body =
      `<p style="color:red">The board said the decision followed a lengthy internal review according to several people familiar with the matter and</p>\n<p><a href="/x">Jane Doe</a></p>\n<p>'s firm.</p>`;
    const html = sanitizeArticleBody(body, { title: "A story" });
    assert.match(html, /<a href="\/x">Jane Doe<\/a>'s firm/);
    assert.doesNotMatch(html, /<\/a><\/p>/);
  });

  it("demotes body h1 and converts markdown headings to h2–h6", () => {
    const html = sanitizeArticleBody(
      `<h1>Standfirst</h1><p>## Markets</p>\n### Policy\n<p>Body copy.</p>`,
      { title: "A different headline" },
    );
    assert.match(html, /<h2[^>]*>Standfirst<\/h2>/);
    assert.match(html, /<h3>Markets<\/h3>/);
    assert.match(html, /<h4>Policy<\/h4>/);
    assert.doesNotMatch(html, /<h1\b/i);
  });

  it("rewrites category-prefixed article hrefs to /{slug}", () => {
    const html = sanitizeArticleBody(
      `<p>See <a href="/tech/apple-on-device-ai-suppliers-recalibrate">the story</a>, <a href="https://www.tradeflockusa.com/finance/foo-bar">another</a>, and <a href="https://www.tradeflock.net/business/another-story">net</a>.</p>`,
      { title: "A story" },
    );
    assert.match(html, /href="\/apple-on-device-ai-suppliers-recalibrate"/);
    assert.match(html, /href="\/foo-bar"/);
    assert.match(html, /href="\/another-story"/);
    assert.doesNotMatch(html, /href="\/tech\//);
    assert.doesNotMatch(html, /href="\/news\//);
  });

  it("strips the leftover Featured Magazine promo and All Magazines link", () => {
    const html = sanitizeArticleBody(
      `<p>The board voted after a lengthy review of the proposal and the market reaction that followed it through the week.</p><h3>Featured Magazine -</h3><a href="https://tradeflockusa.com/top-10-healthcare-executives-transforming-usa-2025/"><img src="https://www.tradeflockusa.com/cover.jpg" alt="cover" /></a><h3>All Magazines</h3><h3>Other Success Insight-</h3>`,
      { title: "A story" },
    );
    assert.match(html, /The board voted after a lengthy review/);
    assert.doesNotMatch(html, /Featured Magazine/);
    assert.doesNotMatch(html, /All Magazines/);
    assert.doesNotMatch(html, /Other Success Insight/);
    assert.doesNotMatch(html, /cover\.jpg/);
  });
});
