import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { magazineDownloadFilename, magazineDownloadPath } from "./magazine-download.ts";

describe("magazineDownloadFilename", () => {
  it("turns messy titles into a TradeFlock editorial filename", () => {
    assert.equal(
      magazineDownloadFilename("file 3", "compressed"),
      "TradeFlock-Magazine-file-3.pdf",
    );
    assert.equal(
      magazineDownloadFilename("USA's Most Influential COOs 2025"),
      "TradeFlock-Magazine-USA-s-Most-Influential-COOs-2025.pdf",
    );
  });

  it("falls back to the slug when the title has no usable characters", () => {
    assert.equal(
      magazineDownloadFilename("@@@", "visionary-ceos-2026"),
      "TradeFlock-Magazine-visionary-ceos-2026.pdf",
    );
  });
});

describe("magazineDownloadPath", () => {
  it("points DearFlip at the slug download route", () => {
    assert.equal(
      magazineDownloadPath("best-hr-leaders-from-usa-2023"),
      "/api/magazine/best-hr-leaders-from-usa-2023/download",
    );
  });
});
