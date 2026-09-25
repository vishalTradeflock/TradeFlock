import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FALLBACK_COVER_IMAGE,
  articleCoverSrc,
  assignDistinctCovers,
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
    assert.equal(resolveCoverImage("https://www.sec.gov/files/report.pdf"), null);
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

  it("never invents a shared stock photo when the source has no image", () => {
    const chosen = selectPublishCover({
      rssImageUrl: null,
      ogImageUrl: "not-a-url",
      article: DESK_ARTICLE,
    });
    assert.equal(chosen, null);
  });

  it("skips the legacy skyscraper even if a feed hands it over", () => {
    const chosen = selectPublishCover({
      rssImageUrl: FALLBACK_COVER_IMAGE,
      ogImageUrl: "https://www.prnewswire.com/media/cover.png",
    });
    assert.equal(chosen, "https://www.prnewswire.com/media/cover.png");
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

  it("renders the neutral card (\"\") for empty, the old fallback, or any legacy stock photo", () => {
    assert.equal(articleCoverSrc({ ...DESK_ARTICLE, cover_image_url: "" }), "");
    assert.equal(articleCoverSrc({ ...DESK_ARTICLE, cover_image_url: FALLBACK_COVER_IMAGE }), "");
    // Same skyscraper photo with different crop params (what the wire pipeline stored).
    assert.equal(
      articleCoverSrc({
        ...DESK_ARTICLE,
        cover_image_url:
          "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
      }),
      "",
    );
    // A former desk-pool photo.
    assert.equal(
      articleCoverSrc({
        ...DESK_ARTICLE,
        cover_image_url:
          "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
      }),
      "",
    );
  });
});

describe("assignDistinctCovers", () => {
  it("keeps the first story's cover and blanks later repeats instead of swapping in stock", () => {
    const shared = "https://mmx.prnewswire.com/media/MS1118010/Rosen-Law-Firm-Logo.jpg";
    const out = assignDistinctCovers([
      { id: "a", title: "A", cover_image_url: `${shared}?id=1&p=original` },
      { id: "b", title: "B", cover_image_url: `${shared}?id=2&p=original` },
      { id: "c", title: "C", cover_image_url: "https://image.cnbcfm.com/api/v1/image/c.jpg" },
      { id: "d", title: "D", cover_image_url: null },
    ]);
    assert.deepEqual(
      out.map((row) => row.cover_image_url),
      [`${shared}?id=1&p=original`, "", "https://image.cnbcfm.com/api/v1/image/c.jpg", ""],
    );
  });
});

describe("isOptimizedCoverHost", () => {
  it("allowlists Unsplash, CNBC, TechCrunch, PR Newswire, and Supabase wildcards", () => {
    assert.equal(isOptimizedCoverHost("images.unsplash.com"), true);
    assert.equal(isOptimizedCoverHost("image.cnbcfm.com"), true);
    assert.equal(isOptimizedCoverHost("techcrunch.com"), true);
    assert.equal(isOptimizedCoverHost("www.techcrunch.com"), true);
    assert.equal(isOptimizedCoverHost("mmx.prnewswire.com"), true);
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
