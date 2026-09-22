import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { shouldBypassImageOptimizer } from "./images.ts";
import {
  IMAGE_DEVICE_SIZES,
  IMAGE_SIZES,
  RELATED_CARD,
  THUMB_64,
  THUMB_80,
  THUMB_96x64,
  candidateWidths,
} from "./image-optimization.ts";

const NEXT_CONFIG = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");

describe("next/image width allowlists", () => {
  it("wires the shared deviceSizes and imageSizes into next.config", () => {
    assert.match(NEXT_CONFIG, /deviceSizes: \[\.\.\.IMAGE_DEVICE_SIZES\]/);
    assert.match(NEXT_CONFIG, /imageSizes: \[\.\.\.IMAGE_SIZES\]/);
    assert.match(NEXT_CONFIG, /from "\.\/src\/lib\/image-optimization"/);
  });

  it("does not disable optimization globally", () => {
    assert.doesNotMatch(NEXT_CONFIG, /unoptimized:\s*true/);
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
    const article = readFileSync(new URL("../app/[slug]/page.tsx", import.meta.url), "utf8");
    assert.match(middle, /width=\{THUMB_64\.width\}/);
    assert.doesNotMatch(middle, /sizes="64px"/);
    assert.match(related, /width=\{RELATED_CARD\.width\}/);
    assert.doesNotMatch(related, /sizes="340px"/);
    assert.match(article, /width=\{THUMB_96x64\.width\}/);
    assert.doesNotMatch(article, /sizes="96px"/);
    assert.match(article, /sizes="\(max-width: 768px\) 100vw/);
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
