import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { shouldBypassImageOptimizer } from "./images.ts";
import {
  ARTICLE_HERO_WIDTHS,
  CARD_16x9,
  HERO_600,
  HOME_HERO_WIDTHS,
  IMAGE_DEVICE_SIZES,
  IMAGE_SIZES,
  LATEST_CARD_WIDTHS,
  RELATED_CARD,
  THUMB_64,
  THUMB_80,
  THUMB_96x64,
  candidateWidths,
} from "./image-optimization.ts";
import { canonicalCoverSrc, coverSrcSet, ogImageSource, resizedCoverUrl } from "./responsive-cover.ts";

const NEXT_CONFIG = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");

describe("next/image width allowlists", () => {
  it("wires the shared deviceSizes and imageSizes into next.config", () => {
    assert.match(NEXT_CONFIG, /deviceSizes: \[\.\.\.IMAGE_DEVICE_SIZES\]/);
    assert.match(NEXT_CONFIG, /imageSizes: \[\.\.\.IMAGE_SIZES\]/);
    assert.match(NEXT_CONFIG, /from "\.\/src\/lib\/image-optimization"/);
  });

  it("keeps main's global unoptimized flag and no custom loader", () => {
    // Image optimization returns 402 once the Vercel quota is exhausted and
    // blanked covers. The width allowlist stays for when that flag is lifted.
    assert.match(NEXT_CONFIG, /unoptimized:\s*true/);
    assert.doesNotMatch(NEXT_CONFIG, /loader:\s*["']custom["']/);
  });

  it("keeps PR Newswire hosts on remotePatterns", () => {
    assert.match(NEXT_CONFIG, /hostname: "mmx\.prnewswire\.com"/);
    assert.match(NEXT_CONFIG, /hostname: "www\.prnewswire\.com"/);
    assert.match(NEXT_CONFIG, /hostname: "prnewswire\.com"/);
  });

  it("does not change default quality", () => {
    assert.doesNotMatch(NEXT_CONFIG, /qualities:/);
  });

  it("drops unused 2048 and 3840 candidates and unused 32/48 thumbs", () => {
    assert.ok(!IMAGE_DEVICE_SIZES.includes(2048 as never));
    assert.ok(!IMAGE_DEVICE_SIZES.includes(3840 as never));
    assert.ok(!IMAGE_SIZES.includes(32 as never));
    assert.ok(!IMAGE_SIZES.includes(48 as never));
    assert.ok(IMAGE_DEVICE_SIZES.includes(1920));
  });
});

describe("candidateWidths (Next 16 getWidths)", () => {
  it("limits 64px thumbs to 1x and 2x", () => {
    assert.deepEqual(candidateWidths({ width: THUMB_64.width }), [64, 128]);
  });

  it("limits 96px thumbs to 96 and the next 2x snap", () => {
    assert.deepEqual(candidateWidths({ width: THUMB_96x64.width }), [96, 256]);
  });

  it("limits 340px cards to a near-1x and 2x snap", () => {
    assert.deepEqual(candidateWidths({ width: RELATED_CARD.width }), [384, 750]);
  });

  it("limits 80px portraits to two snaps", () => {
    assert.deepEqual(candidateWidths({ width: THUMB_80.width }), [96, 256]);
  });

  it("px-only sizes still advertise every width — that is why thumbs use width/height", () => {
    const advertised = candidateWidths({ sizes: "64px" });
    assert.ok(advertised.includes(1920));
    assert.equal(advertised.length, IMAGE_DEVICE_SIZES.length + IMAGE_SIZES.length);
  });

  it("keeps retina hero candidates and drops 4K widths", () => {
    const hero = candidateWidths({ sizes: "(min-width: 1024px) 50vw, 100vw" });
    assert.ok(hero.includes(640));
    assert.ok(hero.includes(1200));
    assert.ok(hero.includes(1920));
    assert.ok(!hero.includes(2048));
    assert.ok(!hero.includes(3840));

    const article = candidateWidths({
      sizes: "(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 850px",
    });
    assert.ok(article.includes(640));
    assert.ok(article.includes(1920));
    assert.ok(!article.includes(3840));
  });
});

describe("fixed thumbs no longer use px-only sizes", () => {
  it("uses intrinsic width/height in the rail and related surfaces", () => {
    const middle = readFileSync(new URL("../components/MiddleScroller.tsx", import.meta.url), "utf8");
    const related = readFileSync(new URL("../components/RelatedArticles.tsx", import.meta.url), "utf8");
    const article = readFileSync(new URL("../app/(public)/[slug]/page.tsx", import.meta.url), "utf8");
    assert.match(middle, /width=\{THUMB_64\.width\}/);
    assert.doesNotMatch(middle, /sizes="64px"/);
    assert.match(related, /width=\{RELATED_CARD\.width\}/);
    assert.doesNotMatch(related, /sizes="340px"/);
    assert.match(article, /width=\{THUMB_96x64\.width\}/);
    assert.match(article, /sizes=\{THUMB_96_SIZES\}/);
    assert.match(article, /sizes=\{ARTICLE_HERO_SIZES\}/);
    assert.match(article, /priority/);
    const sizes = readFileSync(new URL("./image-optimization.ts", import.meta.url), "utf8");
    assert.match(sizes, /ARTICLE_HERO_SIZES =\n  "\(max-width: 768px\) 100vw/);
  });

  it("keeps listing cards off the 1920 srcset slot", () => {
    assert.deepEqual(candidateWidths({ width: CARD_16x9.width }), [384, 828]);
    assert.deepEqual(candidateWidths({ width: HERO_600.width }), [640, 1200]);
    assert.deepEqual([...LATEST_CARD_WIDTHS], [384, 640, 828]);
    assert.ok(!LATEST_CARD_WIDTHS.includes(1920 as never));
    assert.ok(!HOME_HERO_WIDTHS.includes(1920 as never));
    assert.ok(ARTICLE_HERO_WIDTHS.includes(1920));
    const latest = readFileSync(new URL("../components/LatestScroller.tsx", import.meta.url), "utf8");
    const desks = readFileSync(new URL("../components/CategoryFeed.tsx", import.meta.url), "utf8");
    const hero = readFileSync(new URL("../components/HeroCarousel.tsx", import.meta.url), "utf8");
    assert.match(latest, /width=\{CARD_16x9\.width\}/);
    assert.match(latest, /sizes=\{LATEST_CARD_SIZES\}/);
    assert.match(latest, /loading="lazy"/);
    assert.doesNotMatch(latest, /priority/);
    assert.match(desks, /sizes=\{CATEGORY_GRID_SIZES\}/);
    assert.match(desks, /sizes=\{CATEGORY_FEATURED_SIZES\}/);
    assert.match(hero, /sizes=\{HOME_HERO_SIZES\}/);
    assert.match(hero, /priority=\{safeIndex === 0\}/);
  });
});

describe("source srcset while the optimizer is over quota", () => {
  it("resizes Unsplash and keeps ixid, fit, crop, and q", () => {
    const src =
      "https://images.unsplash.com/photo-1592996522990-65ccd3032a61?auto=format&fit=crop&w=1600&q=80&ixid=M3wxMDY4NTc2fDB8MXxzZWFyY2h8MXx8d2lu";
    const out = coverSrcSet(src, LATEST_CARD_WIDTHS, 384);
    assert.equal(out.src.includes("w=384"), true);
    assert.match(out.srcSet ?? "", /w=384[^\s]* 384w/);
    assert.match(out.srcSet ?? "", /w=640[^\s]* 640w/);
    assert.match(out.srcSet ?? "", /w=828[^\s]* 828w/);
    assert.equal((out.srcSet ?? "").includes("w=1920"), false);
    assert.equal(out.src.includes("ixid=M3wxMDY4NTc2fDB8MXxzZWFyY2h8MXx8d2lu"), true);
    assert.equal(out.src.includes("fit=crop"), true);
    assert.equal(out.src.includes("q=80"), true);
  });

  it("scales Unsplash height with width instead of dropping it", () => {
    const src =
      "https://images.unsplash.com/photo-1707960189679-1ea1e312f63f?auto=format&fit=crop&w=1600&h=1000&crop=top&q=80";
    const out = coverSrcSet(src, [384, 640], 384);
    const chosen = new URL(out.src);
    assert.equal(chosen.searchParams.get("w"), "384");
    assert.equal(chosen.searchParams.get("h"), "240");
    assert.equal(chosen.searchParams.get("crop"), "top");
    assert.equal(chosen.searchParams.get("q"), "80");
  });

  it("scales CNBC width and height and keeps v", () => {
    const src =
      "https://image.cnbcfm.com/api/v1/image/108048072.jpeg?v=1791234447&w=1920&h=1080";
    const out = coverSrcSet(src, [384, 828], 384);
    const small = new URL(out.src);
    assert.equal(small.searchParams.get("w"), "384");
    assert.equal(small.searchParams.get("h"), "216");
    assert.equal(small.searchParams.get("v"), "1791234447");
    assert.match(out.srcSet ?? "", / 828w/);
  });

  it("scales a TechCrunch resize pair and leaves other URLs alone", () => {
    const techW = coverSrcSet(
      "https://techcrunch.com/wp-content/uploads/2024/05/breakout_1200x600_ee9b8a.png?w=1200",
      [384, 828],
      384,
    );
    assert.equal(new URL(techW.src).searchParams.get("w"), "384");
    assert.match(techW.srcSet ?? "", /w=828 828w/);

    const tech = coverSrcSet(
      "https://techcrunch.com/wp-content/uploads/2026/10/hgh_web-1.png?resize=1200,920",
      [384, 828],
      384,
    );
    assert.equal(new URL(tech.src).searchParams.get("resize"), "384,294");
    assert.match(tech.srcSet ?? "", /resize=828%2C635 828w|resize=828,635 828w/);

    const prn =
      "https://mmx.prnewswire.com/media/MS1136461/Aurora.jpg?id=OA2988454&p=original";
    const kept = coverSrcSet(prn, LATEST_CARD_WIDTHS, 384);
    assert.equal(kept.src, prn);
    assert.equal(kept.srcSet, undefined);

    const wordpress =
      "https://www.tradeflockusa.com/wp-content/uploads/2026/09/Prophet.webp";
    const photo = coverSrcSet(wordpress, [64, 128], 64);
    assert.equal(photo.src, wordpress);
    assert.equal(photo.srcSet, undefined);
  });

  it("does not ask a source for a width larger than the file it already serves", () => {
    const src = "https://images.unsplash.com/photo-abc?auto=format&fit=crop&w=640&q=80";
    const out = coverSrcSet(src, [384, 640, 828, 1920], 384);
    assert.match(out.srcSet ?? "", / 384w/);
    assert.match(out.srcSet ?? "", / 640w/);
    assert.equal((out.srcSet ?? "").includes("828"), false);
    assert.equal((out.srcSet ?? "").includes("1920"), false);
  });
});

describe("Supabase and Wikimedia source resizing", () => {
  const fuel =
    "https://upload.wikimedia.org/wikipedia/commons/6/62/Apollo_Fuel_Cell_Number_1_%286278224744%29.jpg";
  const ultra =
    "https://nexxoekytzvsqoadazjm.supabase.co/storage/v1/object/public/article-media/newsroom/desk-ma/ultragenyx-prv-sale-210m-chuttersnap-pgfWIStWIfs.jpg";

  it("builds Supabase render URLs with contain and quality 75", () => {
    const out = coverSrcSet(ultra, LATEST_CARD_WIDTHS, 384);
    const chosen = new URL(out.src);
    assert.equal(
      chosen.pathname,
      "/storage/v1/render/image/public/article-media/newsroom/desk-ma/ultragenyx-prv-sale-210m-chuttersnap-pgfWIStWIfs.jpg",
    );
    assert.equal(chosen.searchParams.get("width"), "384");
    assert.equal(chosen.searchParams.get("quality"), "75");
    assert.equal(chosen.searchParams.get("resize"), "contain");
    assert.equal(chosen.searchParams.get("height"), null);
    assert.match(out.srcSet ?? "", /width=384[^\s]* 384w/);
    assert.match(out.srcSet ?? "", /width=640[^\s]* 640w/);
    assert.match(out.srcSet ?? "", /width=828[^\s]* 828w/);
    assert.equal((out.srcSet ?? "").includes("width=1920"), false);
  });

  it("keeps a Supabase crop and does not upscale past the rendered width", () => {
    const cropped = coverSrcSet(
      "https://abcd.supabase.co/storage/v1/render/image/public/bucket/pic.jpg?width=1600&height=900&resize=cover&format=origin",
      [384, 800],
      384,
    );
    const chosen = new URL(cropped.src);
    assert.equal(chosen.searchParams.get("width"), "384");
    assert.equal(chosen.searchParams.get("height"), "216");
    assert.equal(chosen.searchParams.get("resize"), "cover");
    assert.equal(chosen.searchParams.get("quality"), "75");
    assert.equal(chosen.searchParams.get("format"), "origin");

    const capped = coverSrcSet(
      "https://abcd.supabase.co/storage/v1/render/image/public/bucket/pic.jpg?width=640&quality=80",
      [384, 640, 1200],
      384,
    );
    assert.match(capped.srcSet ?? "", /width=384/);
    assert.match(capped.srcSet ?? "", /width=640/);
    assert.equal((capped.srcSet ?? "").includes("1200"), false);

    const signed =
      "https://abcd.supabase.co/storage/v1/object/sign/bucket/pic.jpg?token=abc";
    assert.equal(coverSrcSet(signed, [384, 640], 384).src, signed);
  });

  it("snaps Wikimedia thumbs to allowed widths and keeps the encoded filename", () => {
    const out = coverSrcSet(fuel, LATEST_CARD_WIDTHS, 384);
    assert.match(
      out.src,
      /\/wikipedia\/commons\/thumb\/6\/62\/Apollo_Fuel_Cell_Number_1_%286278224744%29\.jpg\/330px-Apollo_Fuel_Cell_Number_1_%286278224744%29\.jpg$/,
    );
    assert.match(out.srcSet ?? "", /330px-Apollo_Fuel_Cell_Number_1_%286278224744%29\.jpg 330w/);
    assert.match(out.srcSet ?? "", /500px-Apollo_Fuel_Cell_Number_1_%286278224744%29\.jpg 500w/);
    assert.equal((out.srcSet ?? "").includes("384"), false);
    assert.equal((out.srcSet ?? "").includes("640"), false);
    assert.equal((out.srcSet ?? "").includes("828"), false);
    assert.equal((out.srcSet ?? "").split(", ").length, 2);
  });

  it("does not request a Wikimedia thumb wider than the one already named", () => {
    const thumb =
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Apollo_Fuel_Cell_Number_1_%286278224744%29.jpg/500px-Apollo_Fuel_Cell_Number_1_%286278224744%29.jpg";
    const out = coverSrcSet(thumb, [384, 828, 1920], 384);
    assert.match(out.srcSet ?? "", /330px-/);
    assert.match(out.srcSet ?? "", /500px-/);
    assert.equal((out.srcSet ?? "").includes("960"), false);
    assert.equal((out.srcSet ?? "").includes("1280"), false);
    assert.equal((out.srcSet ?? "").includes("1920"), false);
  });

  it("adds a png suffix for SVG and TIFF thumbs and skips other types", () => {
    const svg = coverSrcSet(
      "https://upload.wikimedia.org/wikipedia/commons/4/4a/Commons-logo.svg",
      [64, 128],
      64,
    );
    assert.match(svg.src, /\/thumb\/4\/4a\/Commons-logo\.svg\/60px-Commons-logo\.svg\.png$/);
    assert.match(svg.srcSet ?? "", /120px-Commons-logo\.svg\.png 120w/);

    const tiff = coverSrcSet(
      "https://upload.wikimedia.org/wikipedia/commons/d/d8/Example.tiff",
      [100, 200],
      100,
    );
    assert.match(tiff.srcSet ?? "", /60px-Example\.tiff\.png 60w/);
    assert.match(tiff.srcSet ?? "", /120px-Example\.tiff\.png 120w/);

    const pdf = "https://upload.wikimedia.org/wikipedia/commons/a/ab/Paper.pdf";
    const skipped = coverSrcSet(pdf, [384, 640], 384);
    assert.equal(skipped.src, pdf);
    assert.equal(skipped.srcSet, undefined);

    const otherWiki = "https://upload.wikimedia.org/wikipedia/en/a/ab/Logo.jpg";
    assert.equal(coverSrcSet(otherWiki, [384, 640], 384).src, otherWiki);
  });

  it("rewrites www.tradeflock.us wp-content covers onto www.tradeflockusa.com", () => {
    const src = "https://www.tradeflock.us/wp-content/uploads/2026/07/Yann-A.-Meunier-MD.webp?ver=2";
    assert.equal(
      canonicalCoverSrc(src),
      "https://www.tradeflockusa.com/wp-content/uploads/2026/07/Yann-A.-Meunier-MD.webp?ver=2",
    );
    const out = coverSrcSet(src, [64, 128], 64);
    assert.equal(out.src, canonicalCoverSrc(src));
    assert.equal(out.srcSet, undefined);

    const article = "https://www.tradeflock.us/some-story";
    assert.equal(canonicalCoverSrc(article), article);
    const apex = "https://tradeflock.us/wp-content/uploads/a.jpg";
    assert.equal(canonicalCoverSrc(apex), apex);
  });

  it("points og:image sources at about 1200w and leaves other hosts on the original", () => {
    const fuelOg = ogImageSource(fuel);
    assert.match(fuelOg, /\/960px-Apollo_Fuel_Cell_Number_1_%286278224744%29\.jpg$/);
    assert.equal(resizedCoverUrl(fuel, 1200), fuelOg);

    const ultraOg = new URL(ogImageSource(ultra));
    assert.equal(ultraOg.searchParams.get("width"), "1200");
    assert.equal(ultraOg.searchParams.get("quality"), "75");
    assert.equal(ultraOg.searchParams.get("resize"), "contain");

    const prn = "https://mmx.prnewswire.com/media/MS1136461/Aurora.jpg?p=original";
    assert.equal(ogImageSource(prn), prn);
    assert.equal(resizedCoverUrl(prn, 1200), null);

    const alreadySmall = "https://images.unsplash.com/photo-abc?auto=format&w=640&q=80";
    assert.equal(ogImageSource(alreadySmall), alreadySmall);

    const wide = ogImageSource("https://images.unsplash.com/photo-abc?auto=format&fit=crop&w=1600&h=1000&q=80");
    const wideUrl = new URL(wide);
    assert.equal(wideUrl.searchParams.get("w"), "1200");
    assert.equal(wideUrl.searchParams.get("h"), "750");
    assert.equal(wideUrl.searchParams.get("q"), "80");

    const wordpress = "https://www.tradeflock.us/wp-content/uploads/2026/09/Prophet.webp";
    assert.equal(
      ogImageSource(wordpress),
      "https://www.tradeflockusa.com/wp-content/uploads/2026/09/Prophet.webp",
    );
  });

  it("wires the og:image helper without changing sitemap image URLs", () => {
    const seo = readFileSync(new URL("./seo.ts", import.meta.url), "utf8");
    const route = readFileSync(new URL("../app/media/proxy/route.ts", import.meta.url), "utf8");
    const sitemap = readFileSync(new URL("./sitemap-urls.ts", import.meta.url), "utf8");
    assert.match(seo, /ogImageSource\(image\.url\)/);
    assert.match(route, /resizedCoverUrl\(original\.toString\(\), OG_COVER_WIDTH\)/);
    assert.match(route, /MEDIA_PROXY_MAX_BYTES/);
    assert.doesNotMatch(sitemap, /ogImageSource|resizedCoverUrl|canonicalCoverSrc/);
    assert.match(NEXT_CONFIG, /unoptimized:\s*true/);
  });
});

describe("PR Newswire covers stay on the optimizer", () => {
  it("does not bypass next/image for mmx.prnewswire.com", () => {
    assert.equal(
      shouldBypassImageOptimizer("https://mmx.prnewswire.com/media/123/sopra.jpg?w=800&h=450"),
      false,
    );
  });
});
