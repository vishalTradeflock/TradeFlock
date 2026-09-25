import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { TARGETED_NOINDEX_PATHS } from "./targeted-noindex-paths.ts";
import {
  TARGETED_NOINDEX_HEADER_VALUE,
  TARGETED_NOINDEX_META_CONTENT,
  normalizeNoindexPath,
  shouldNoindexPath,
  targetedNoindexHeaders,
  targetedNoindexMetadata,
} from "./targeted-noindex.ts";

function read(relativeFromLib: string) {
  return readFileSync(new URL(relativeFromLib, import.meta.url), "utf8");
}

const SAMPLE_TARGETED = TARGETED_NOINDEX_PATHS.slice(0, 5);

describe("targeted noindex from Index status.pdf", () => {
  it("stores unique pathnames only", () => {
    assert.equal(TARGETED_NOINDEX_PATHS.length, 114);
    assert.equal(new Set(TARGETED_NOINDEX_PATHS).size, TARGETED_NOINDEX_PATHS.length);
  });

  it("recognizes every unique extracted pathname as noindex", () => {
    for (const path of TARGETED_NOINDEX_PATHS) {
      assert.equal(shouldNoindexPath(path), true, path);
      assert.deepEqual(targetedNoindexMetadata(path), {
        robots: { index: false, follow: true },
      });
    }
  });

  it("marks at least five targeted URLs noindex,follow", () => {
    assert.ok(SAMPLE_TARGETED.length >= 5);
    for (const path of SAMPLE_TARGETED) {
      assert.equal(shouldNoindexPath(`https://www.tradeflock.net${path}/`), true);
      assert.deepEqual(targetedNoindexMetadata(path).robots, {
        index: false,
        follow: true,
      });
      assert.equal(TARGETED_NOINDEX_META_CONTENT, "noindex,follow");
    }
  });

  it("keeps a targeted URL noindex with a query string or trailing slash", () => {
    const path = TARGETED_NOINDEX_PATHS[0];
    assert.equal(normalizeNoindexPath(`${path}/`), path);
    assert.equal(shouldNoindexPath(`${path}/`), true);
    assert.equal(shouldNoindexPath(`${path}?utm_source=test`), true);
    assert.equal(
      shouldNoindexPath(`https://www.tradeflock.net${path}/?utm_source=test#top`),
      true,
    );
  });

  it("does not use prefix or keyword matching", () => {
    const path = TARGETED_NOINDEX_PATHS[0];
    assert.equal(shouldNoindexPath(`${path}-extra`), false);
    assert.equal(shouldNoindexPath("/tech"), false);
    assert.equal(shouldNoindexPath("/2026"), false);
    assert.equal(shouldNoindexPath("/magazine"), false);
  });

  it("noindexes the four Empowering Women Leaders profiles", () => {
    const paths = [
      "/samyuktha-kilaru-samy-most-empowering-women-leaders-to-watch-in-2026",
      "/anne-marie-charest-most-empowering-women-leaders-to-watch-in-2026",
      "/crystal-e-rizzuto-most-empowering-women-leaders-to-watch-in-2026",
      "/gita-poudel-most-empowering-women-leaders-to-watch-in-2026",
    ];
    for (const path of paths) {
      assert.equal(shouldNoindexPath(`https://www.tradeflock.net${path}`), true, path);
      assert.deepEqual(targetedNoindexMetadata(path).robots, {
        index: false,
        follow: true,
      });
    }
  });

  it("leaves the homepage and unrelated public pages indexable", () => {
    assert.equal(shouldNoindexPath("/"), false);
    assert.deepEqual(targetedNoindexMetadata("/"), {});
    assert.equal(shouldNoindexPath("/about"), false);
    assert.equal(shouldNoindexPath("/tech"), false);
    assert.equal(shouldNoindexPath("/apple-on-device-ai-suppliers-recalibrate"), false);
    assert.deepEqual(
      targetedNoindexMetadata("/apple-on-device-ai-suppliers-recalibrate"),
      {},
    );
  });

  it("wires targeted robots into article, public, and magazine metadata helpers", () => {
    const seo = read("./seo.ts");
    assert.match(seo, /targetedNoindexMetadata\(articlePath\(article\.slug\)\)/);
    assert.match(seo, /targetedNoindexMetadata\(path\)/);
    assert.equal(seo.includes("...targetedNoindexMetadata(path)"), true);
  });

  it("sets X-Robots-Tag only for exact targeted paths", () => {
    const headers = targetedNoindexHeaders();
    assert.equal(TARGETED_NOINDEX_HEADER_VALUE, "noindex, follow");
    assert.equal(headers.length, TARGETED_NOINDEX_PATHS.length * 2);
    assert.ok(!headers.some((entry) => entry.source === "/:path*"));
    assert.ok(!headers.some((entry) => entry.source === "/"));

    for (const path of SAMPLE_TARGETED) {
      const exact = headers.find((entry) => entry.source === path);
      const slash = headers.find((entry) => entry.source === `${path}/`);
      assert.deepEqual(exact?.headers, [
        { key: "X-Robots-Tag", value: "noindex, follow" },
      ]);
      assert.deepEqual(slash?.headers, [
        { key: "X-Robots-Tag", value: "noindex, follow" },
      ]);
    }
  });

  it("removes the temporary sitewide noindex switch", () => {
    const layout = read("../app/layout.tsx");
    const config = read("../../next.config.ts");
    const home = read("../app/page.tsx");

    assert.doesNotMatch(layout, /sitewideNoindexMetadata/);
    assert.doesNotMatch(layout, /TEMPORARY_SITEWIDE_NOINDEX/);
    assert.doesNotMatch(layout, /SITEWIDE_NOINDEX_META_CONTENT/);
    assert.doesNotMatch(layout, /<meta name="robots"/);
    assert.match(config, /targetedNoindexHeaders/);
    assert.doesNotMatch(config, /sitewideNoindexHeaders/);
    assert.doesNotMatch(config, /source:\s*"\/:path\*"/);
    assert.match(home, /path:\s*"\/"/);
    assert.doesNotMatch(home, /index:\s*false/);
  });

  it("keeps robots.txt, sitemap purpose, and studio noindex unchanged", () => {
    const robots = read("../app/robots.ts");
    const sitemap = read("../app/sitemap.ts");
    const studio = read("../app/studio/layout.tsx");
    const seo = read("./seo.ts");

    assert.match(robots, /allow:\s*"\/"/);
    assert.match(robots, /disallow:\s*\["\/studio\/",\s*"\/api\/"\]/);
    assert.match(robots, /sitemap:\s*"https:\/\/www\.tradeflock\.net\/sitemap\.xml"/);
    assert.doesNotMatch(robots, /disallow:\s*"\/"/);
    assert.match(sitemap, /export default async function sitemap/);
    assert.doesNotMatch(sitemap, /targetedNoindex|noindex|TEMPORARY_SITEWIDE_NOINDEX/);
    assert.match(studio, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
    assert.doesNotMatch(seo, /robots:\s*\{\s*index:\s*true/);
    assert.match(seo, /alternates:\s*\{\s*canonical:/);
    assert.match(seo, /openGraph:/);
    assert.match(seo, /twitter:/);
  });
});
