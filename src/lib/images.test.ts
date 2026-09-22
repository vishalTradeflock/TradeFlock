import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FALLBACK_COVER_IMAGE,
  articleCoverSrc,
  deskCoverFallback,
  isHttpsCoverUrl,
  isOptimizedCoverHost,
  resolveCoverImage,
  sanitizeCoverUrl,
  decodeCoverHtmlEntities,
  selectPublishCover,
  shouldBypassImageOptimizer,
} from "./images.ts";

const CNBC_COVER =
  "https://image.cnbcfm.com/api/v1/image/107123456-benioff.jpg?v=1726400000&w=1920&h=1080";

const DESK_ARTICLE = {
  id: "wire-benioff",
  title: "Salesforce CEO Marc Benioff warns of AI risks",
  slug: "salesforce-ceo-marc-benioff-warns-of-ai-risks",
  category: { slug: "tech" },
};

describe("sanitizeCoverUrl", () => {
  it("decodes a single &amp; in a CNBC query string", () => {
    const encoded =
      "https://image.cnbcfm.com/api/v1/image/107123456-benioff.jpg?v=1726400000&amp;w=1920&amp;h=1080";
    assert.equal(sanitizeCoverUrl(encoded), CNBC_COVER);
    assert.equal(isHttpsCoverUrl(encoded), true);
    assert.equal(resolveCoverImage(encoded), CNBC_COVER);
  });

  it("decodes double-encoded &amp;amp; used by PR Newswire / CNBC live HTML", () => {
    const doubleEncoded =
      "https://mmx.prnewswire.com/media/123/sopra.jpg?w=800&amp;amp;h=450";
    assert.equal(
      sanitizeCoverUrl(doubleEncoded),
      "https://mmx.prnewswire.com/media/123/sopra.jpg?w=800&h=450",
    );
    assert.doesNotMatch(sanitizeCoverUrl(doubleEncoded) ?? "", /&amp;/);
  });

  it("trims, rejects empty values, and rejects document URLs", () => {
    assert.equal(sanitizeCoverUrl("   "), null);
    assert.equal(sanitizeCoverUrl(""), null);
    assert.equal(sanitizeCoverUrl(null), null);
    assert.equal(sanitizeCoverUrl("http://example.com/a.jpg"), null);
    assert.equal(sanitizeCoverUrl("https://www.sec.gov/files/report.pdf"), null);
    assert.equal(sanitizeCoverUrl("javascript:alert(1)"), null);
    assert.equal(resolveCoverImage("https://www.sec.gov/files/report.pdf"), FALLBACK_COVER_IMAGE);
  });
});

describe("selectPublishCover", () => {
  it("prefers a sanitized RSS/enclosure URL over og:image and the desk fallback", () => {
    const chosen = selectPublishCover({
      rssImageUrl:
        "https://image.cnbcfm.com/api/v1/image/107123456-benioff.jpg?v=1&amp;amp;w=1600",
      ogImageUrl: "https://www.techcrunch.com/wp-content/uploads/og.jpg",
      article: DESK_ARTICLE,
    });
    assert.equal(
      chosen,
      "https://image.cnbcfm.com/api/v1/image/107123456-benioff.jpg?v=1&w=1600",
    );
  });

  it("uses og:image when the feed enclosure is missing or unusable", () => {
    const chosen = selectPublishCover({
      rssImageUrl: "https://www.sec.gov/files/report.pdf",
      notesCoverUrl: "   ",
      ogImageUrl: "https://www.prnewswire.com/media/cover.png?foo=1&amp;bar=2",
      article: DESK_ARTICLE,
    });
    assert.equal(chosen, "https://www.prnewswire.com/media/cover.png?foo=1&bar=2");
  });

  it("never leaves the cover empty when a desk Unsplash fallback exists", () => {
    const chosen = selectPublishCover({
      rssImageUrl: null,
      ogImageUrl: "not-a-url",
      article: DESK_ARTICLE,
    });
    const desk = deskCoverFallback(DESK_ARTICLE);
    assert.equal(chosen, desk);
    assert.match(chosen, /^https:\/\/images\.unsplash\.com\//);
    assert.notEqual(chosen, "");
  });
});

describe("articleCoverSrc", () => {
  it("sanitizes a stored cover instead of swapping in the skyscraper fallback", () => {
    assert.equal(
      articleCoverSrc({
        ...DESK_ARTICLE,
        cover_image_url:
          "https://image.cnbcfm.com/api/v1/image/benioff.jpg?v=1&amp;amp;w=1920",
      }),
      "https://image.cnbcfm.com/api/v1/image/benioff.jpg?v=1&w=1920",
    );
  });

  it("uses the desk Unsplash pool when the stored cover is empty or the generic fallback", () => {
    const empty = articleCoverSrc({ ...DESK_ARTICLE, cover_image_url: "" });
    const generic = articleCoverSrc({
      ...DESK_ARTICLE,
      cover_image_url: FALLBACK_COVER_IMAGE,
    });
    assert.equal(empty, deskCoverFallback(DESK_ARTICLE));
    assert.equal(generic, deskCoverFallback(DESK_ARTICLE));
    assert.notEqual(empty, FALLBACK_COVER_IMAGE);
  });
});

describe("isOptimizedCoverHost", () => {
  it("allowlists Unsplash, CNBC, TechCrunch, PR Newswire, and Supabase wildcards", () => {
    assert.equal(isOptimizedCoverHost("images.unsplash.com"), true);
    assert.equal(isOptimizedCoverHost("image.cnbcfm.com"), true);
    assert.equal(isOptimizedCoverHost("techcrunch.com"), true);
    assert.equal(isOptimizedCoverHost("www.techcrunch.com"), true);
    assert.equal(isOptimizedCoverHost("mmx.prnewswire.com"), true);
    assert.equal(
      shouldBypassImageOptimizer("https://mmx.prnewswire.com/media/123/sopra.jpg"),
      false,
    );
    assert.equal(isOptimizedCoverHost("abcd1234.supabase.co"), true);
    assert.equal(shouldBypassImageOptimizer(CNBC_COVER), false);
    assert.equal(shouldBypassImageOptimizer("https://exotic.example.net/photo.jpg"), true);
  });
});

describe("og:image entity decoding", () => {
  it("decodes og:image-style URLs after resolving against the source page", () => {
    const raw = decodeCoverHtmlEntities(
      "https://image.cnbcfm.com/api/v1/image/benioff.jpg?v=1&amp;amp;w=1920",
    );
    const absolute = new URL(raw, "https://www.cnbc.com/benioff").toString();
    assert.equal(
      sanitizeCoverUrl(absolute),
      "https://image.cnbcfm.com/api/v1/image/benioff.jpg?v=1&w=1920",
    );

    const relative = decodeCoverHtmlEntities("/media/cover.png?w=800&amp;h=450");
    assert.equal(
      sanitizeCoverUrl(new URL(relative, "https://www.prnewswire.com/news-releases/example").toString()),
      "https://www.prnewswire.com/media/cover.png?w=800&h=450",
    );
  });
});
