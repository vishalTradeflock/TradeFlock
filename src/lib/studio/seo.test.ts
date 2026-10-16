import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  SEO_TITLE_LIMIT,
  TITLE_BRAND_SUFFIX,
  TITLE_BRAND_SUFFIX_MAX,
  articleDocumentTitle,
  capDisplayTitle,
} from "./seo.ts";

const SCHWAB = "Schwab Earnings: Sweep Cash Fell Excluding Short Credits";
const YEXT = "Yext CEO Option Grant: 14 Price Hurdles Up to $88.08";
const TESLA = "Tesla Roadster Price: $250,000 Deposit, No Sticker Yet";
const PENSKE_H1 = "Penske Automotive Take Private Needs Only $4B in New Money";
const PENSKE_SEO = "Penske Automotive Take Private: $4B Needed, Not $16B";

describe("articleDocumentTitle", () => {
  it("uses the headline and omits the brand when the headline is longer than 50", () => {
    assert.equal(SCHWAB.length, 56);
    assert.equal(YEXT.length, 52);
    assert.equal(TESLA.length, 54);
    assert.equal(articleDocumentTitle(null, SCHWAB), SCHWAB);
    assert.equal(articleDocumentTitle("  ", YEXT), YEXT);
    assert.equal(articleDocumentTitle(undefined, TESLA), TESLA);
    assert.equal(SCHWAB.includes("TradeFlock"), false);
  });

  it("prefers meta_title and still omits the brand above 50 characters", () => {
    assert.equal(PENSKE_SEO.length, 52);
    assert.equal(PENSKE_H1.length, 58);
    assert.equal(articleDocumentTitle(PENSKE_SEO, PENSKE_H1), PENSKE_SEO);
  });

  it("appends the brand only when the chosen title is 50 characters or fewer", () => {
    const fifty = "A".repeat(TITLE_BRAND_SUFFIX_MAX);
    const fiftyOne = "A".repeat(TITLE_BRAND_SUFFIX_MAX + 1);
    assert.equal(articleDocumentTitle(null, fifty), `${fifty}${TITLE_BRAND_SUFFIX}`);
    assert.equal(articleDocumentTitle(null, fiftyOne), fiftyOne);
    assert.equal(articleDocumentTitle("Fed Holds Rates", SCHWAB), `Fed Holds Rates${TITLE_BRAND_SUFFIX}`);
  });

  it("caps a custom SEO title at 60 characters before the brand decision", () => {
    const long = "B".repeat(80);
    assert.equal(capDisplayTitle(long), "B".repeat(SEO_TITLE_LIMIT));
    assert.equal(articleDocumentTitle(long, SCHWAB), "B".repeat(SEO_TITLE_LIMIT));
    const padded = `${"C".repeat(58)}  tail`;
    assert.equal(articleDocumentTitle(padded, SCHWAB).length <= SEO_TITLE_LIMIT, true);
    assert.equal(articleDocumentTitle(padded, SCHWAB).endsWith(TITLE_BRAND_SUFFIX), false);
  });

  it("does not cap the headline when meta_title is blank", () => {
    const headline = "D".repeat(70);
    assert.equal(articleDocumentTitle(null, headline), headline);
  });
});

describe("article metadata wiring", () => {
  it("shares one absolute title across the document, Open Graph, and Twitter", () => {
    const source = readFileSync(new URL("../seo.ts", import.meta.url), "utf8");
    const start = source.indexOf("export function articlePageMetadata");
    const end = source.indexOf("export function magazinePageMetadata");
    const fn = source.slice(start, end);
    assert.ok(start >= 0 && end > start);
    assert.match(fn, /const title = articleDocumentTitle\(article\.meta_title, article\.title\)/);
    assert.match(fn, /title:\s*\{\s*absolute:\s*title\s*\}/);
    assert.match(fn, /openGraph:\s*\{[\s\S]*?\btitle,/);
    assert.match(fn, /twitter:\s*\{[\s\S]*?\btitle,/);
  });

  it("leaves the visible headline and JSON-LD headline on the H1", () => {
    const seo = readFileSync(new URL("../seo.ts", import.meta.url), "utf8");
    const structuredStart = seo.indexOf("export function articleStructuredData");
    const structuredEnd = seo.indexOf("export function magazineStructuredData");
    const structured = seo.slice(structuredStart, structuredEnd);
    assert.match(structured, /headline:\s*article\.title/);
    assert.doesNotMatch(structured, /articleDocumentTitle|meta_title/);

    const page = readFileSync(new URL("../../app/(public)/[slug]/page.tsx", import.meta.url), "utf8");
    assert.match(page, /<h1[\s\S]*?>\s*\{article\.title\}\s*<\/h1>/);
  });
});
