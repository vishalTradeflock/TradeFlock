import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  SITEWIDE_NOINDEX_HEADER_VALUE,
  SITEWIDE_NOINDEX_META_CONTENT,
  TEMPORARY_SITEWIDE_NOINDEX,
  sitewideNoindexHeaders,
  sitewideNoindexMetadata,
} from "./sitewide-noindex.ts";

function read(relativeFromLib: string) {
  return readFileSync(new URL(relativeFromLib, import.meta.url), "utf8");
}

describe("temporary sitewide noindex", () => {
  it("keeps the audit flag on in one obvious module", () => {
    const source = read("./sitewide-noindex.ts");
    assert.equal(TEMPORARY_SITEWIDE_NOINDEX, true);
    assert.match(source, /TEMPORARY_SITEWIDE_NOINDEX = true/);
    assert.match(source, /TEMPORARY SEO AUDIT: remove this flag after the audit is complete/);
  });

  it("homepage, articles, and dynamic pages inherit noindex,follow", () => {
    const layout = read("../app/layout.tsx");
    const home = read("../app/page.tsx");
    const article = read("../app/[slug]/page.tsx");
    const author = read("../app/author/[slug]/page.tsx");
    const seo = read("./seo.ts");

    assert.equal(SITEWIDE_NOINDEX_META_CONTENT, "noindex,follow");
    assert.deepEqual(sitewideNoindexMetadata(), {
      robots: { index: false, follow: true },
    });

    assert.match(layout, /sitewideNoindexMetadata\(\)/);
    assert.match(layout, /TEMPORARY_SITEWIDE_NOINDEX/);
    assert.match(layout, /<meta name="robots" content=\{SITEWIDE_NOINDEX_META_CONTENT\} \/>/);

    assert.match(home, /export const metadata/);
    assert.doesNotMatch(home, /index:\s*true/);
    assert.doesNotMatch(home, /robots:\s*\{\s*index:\s*true/);

    assert.match(article, /export async function generateMetadata/);
    assert.match(article, /return articlePageMetadata\(article\)/);
    assert.doesNotMatch(article, /index:\s*true/);

    assert.match(author, /export async function generateMetadata/);
    assert.match(author, /return publicPageMetadata\(/);
    assert.doesNotMatch(author, /index:\s*true/);

    assert.match(seo, /export function articlePageMetadata/);
    assert.match(seo, /export function publicPageMetadata/);
    assert.doesNotMatch(seo, /robots:\s*\{\s*index:\s*true/);
    assert.match(seo, /alternates:\s*\{\s*canonical:/);
    assert.match(seo, /openGraph:/);
    assert.match(seo, /twitter:/);
  });

  it("sets X-Robots-Tag: noindex, follow for every HTML route", () => {
    const headers = sitewideNoindexHeaders();
    assert.equal(SITEWIDE_NOINDEX_HEADER_VALUE, "noindex, follow");
    assert.ok(headers.some((entry) => entry.source === "/"));
    assert.ok(headers.some((entry) => entry.source === "/:path*"));
    for (const entry of headers) {
      assert.deepEqual(entry.headers, [
        { key: "X-Robots-Tag", value: "noindex, follow" },
      ]);
    }
    const config = read("../../next.config.ts");
    assert.match(config, /sitewideNoindexHeaders/);
    assert.match(config, /async headers\(\)/);
  });

  it("does not make a generateMetadata route indexable", () => {
    const magazine = read("../app/magazine/[slug]/page.tsx");
    const magazineRead = read("../app/magazine/[slug]/read/page.tsx");
    assert.match(magazine, /export async function generateMetadata/);
    assert.match(magazineRead, /export async function generateMetadata/);
    assert.doesNotMatch(magazine, /index:\s*true/);
    assert.doesNotMatch(magazineRead, /index:\s*true/);
  });

  it("keeps robots.txt crawlable without Disallow: /", () => {
    const source = read("../app/robots.ts");
    assert.match(source, /allow:\s*"\/"/);
    assert.match(source, /disallow:\s*\["\/studio\/",\s*"\/api\/"\]/);
    assert.match(source, /sitemap:\s*"https:\/\/www\.tradeflock\.net\/sitemap\.xml"/);
    assert.doesNotMatch(source, /disallow:\s*"\/"/);
    assert.doesNotMatch(source, /Disallow:\s*\//);
  });

  it("keeps sitemap.xml wired and unchanged in purpose", () => {
    const source = read("../app/sitemap.ts");
    assert.match(source, /export default async function sitemap/);
    assert.match(source, /MetadataRoute\.Sitemap/);
    assert.doesNotMatch(source, /TEMPORARY_SITEWIDE_NOINDEX/);
    assert.doesNotMatch(source, /noindex/);
  });

  it("preserves studio noindex,nofollow under the sitewide switch", () => {
    const studio = read("../app/studio/layout.tsx");
    assert.match(studio, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  });
});
