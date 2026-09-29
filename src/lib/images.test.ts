import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  FALLBACK_COVER_IMAGE,
  EDITORIAL_COVERS,
  articleCoverSrc,
  assignDistinctCovers,
  deskCoverFallback,
  isHttpsCoverUrl,
  isLegacyStockCover,
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

const FINANCE_POOL_PHOTO =
  "https://images.unsplash.com/photo-1565514020176-b31d2542ed3e?auto=format&fit=crop&w=1200&q=80";

const MAGPRO_COVER =
  "https://mmx.prnewswire.com/media/123/magpro-aerolev.jpg?p=original";

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

  it("keeps a story's own PR Newswire JPEG", () => {
    assert.equal(
      articleCoverSrc({
        ...DESK_ARTICLE,
        id: "magpro",
        slug: "magpro-aerolev-1850-cooling-launch",
        category: { slug: "finance" },
        cover_image_url: MAGPRO_COVER,
      }),
      MAGPRO_COVER,
    );
  });

  it("renders the neutral card (\"\") for empty, the old fallback, or any legacy stock photo", () => {
    assert.equal(articleCoverSrc({ ...DESK_ARTICLE, cover_image_url: "" }), "");
    assert.equal(articleCoverSrc({ ...DESK_ARTICLE, cover_image_url: FALLBACK_COVER_IMAGE }), "");
    assert.equal(isLegacyStockCover(FALLBACK_COVER_IMAGE), true);
    assert.equal(isLegacyStockCover(FINANCE_POOL_PHOTO), true);
    // Same skyscraper photo with different crop params (what the wire pipeline stored).
    assert.equal(
      articleCoverSrc({
        ...DESK_ARTICLE,
        cover_image_url:
          "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
      }),
      "",
    );
    // The shared finance-pool photo previously passed as fallbackSrc.
    assert.equal(
      articleCoverSrc({
        ...DESK_ARTICLE,
        category: { slug: "finance" },
        cover_image_url: FINANCE_POOL_PHOTO,
      }),
      "",
    );
    assert.notEqual(
      articleCoverSrc({ ...DESK_ARTICLE, cover_image_url: "" }),
      deskCoverFallback(DESK_ARTICLE),
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
      { id: "e", title: "E", cover_image_url: FINANCE_POOL_PHOTO },
      { id: "f", title: "F", cover_image_url: MAGPRO_COVER },
    ]);
    assert.deepEqual(
      out.map((row) => row.cover_image_url),
      [`${shared}?id=1&p=original`, "", "https://image.cnbcfm.com/api/v1/image/c.jpg", "", "", MAGPRO_COVER],
    );
    const poolIds = new Set(
      [FALLBACK_COVER_IMAGE, ...EDITORIAL_COVERS].map((url) => url.match(/photo-[a-zA-Z0-9_-]+/)?.[0]),
    );
    for (const row of out) {
      const photo = row.cover_image_url?.match(/photo-[a-zA-Z0-9_-]+/)?.[0];
      if (photo) assert.equal(poolIds.has(photo), false);
    }
  });

  it("does not give two stories with missing covers the same photo", () => {
    const out = assignDistinctCovers([
      { id: "one", title: "One", cover_image_url: "" },
      { id: "two", title: "Two", cover_image_url: FALLBACK_COVER_IMAGE },
    ]);
    assert.deepEqual(
      out.map((row) => row.cover_image_url),
      ["", ""],
    );
  });
});

describe("render path", () => {
  it("does not pass a shared stock fallback into the image components", () => {
    const files = [
      new URL("../components/SafeArticleImage.tsx", import.meta.url),
      new URL("../components/HeroCarousel.tsx", import.meta.url),
      new URL("../components/LatestScroller.tsx", import.meta.url),
      new URL("../components/RelatedArticles.tsx", import.meta.url),
      new URL("../app/[slug]/page.tsx", import.meta.url),
      new URL("../app/page.tsx", import.meta.url),
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.equal(source.includes("fallbackSrc"), false, file.pathname);
      assert.equal(source.includes("deskCoverFallback"), false, file.pathname);
      assert.equal(source.includes("FALLBACK_COVER_IMAGE"), false, file.pathname);
      assert.equal(source.includes("photo-1565514020176"), false, file.pathname);
      assert.equal(source.includes("photo-1486406146926"), false, file.pathname);
    }
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
