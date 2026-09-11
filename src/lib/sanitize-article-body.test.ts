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
});
