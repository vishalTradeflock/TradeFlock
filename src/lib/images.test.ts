import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FALLBACK_COVER_IMAGE, isHttpsCoverUrl, resolveCoverImage } from "./images.ts";

describe("resolveCoverImage", () => {
  it("keeps a source/OG https image instead of swapping in the fallback", () => {
    const url = "https://image.cnbcfm.com/api/v1/image/benioff.jpg";
    assert.equal(isHttpsCoverUrl(url), true);
    assert.equal(resolveCoverImage(url), url);
  });

  it("rejects non-https and document URLs", () => {
    assert.equal(isHttpsCoverUrl("http://example.com/a.jpg"), false);
    assert.equal(resolveCoverImage("https://www.sec.gov/files/report.pdf"), FALLBACK_COVER_IMAGE);
  });
});
