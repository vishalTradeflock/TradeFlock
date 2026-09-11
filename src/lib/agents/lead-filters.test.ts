import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isMostlyEnglishTitle,
  isUsableLeadItem,
  titlesAreNearDuplicate,
} from "./lead-filters.ts";

describe("isMostlyEnglishTitle", () => {
  it("accepts a U.S. business headline", () => {
    assert.equal(
      isMostlyEnglishTitle(
        "U.S. chip equipment makers report a jump in export licenses for allied fabs",
      ),
      true,
    );
  });

  it("rejects CJK class-action wire copy", () => {
    assert.equal(
      isMostlyEnglishTitle(
        "Finkelstein Thompson LLP 和 Lovell Stewart Halebian Jacobson LLP 公布拟议集体诉讼和解方案",
      ),
      false,
    );
  });
});

describe("isUsableLeadItem", () => {
  it("requires an http(s) link and skips listicle bait", () => {
    assert.equal(
      isUsableLeadItem("These 10 stocks to watch this week for traders", "https://example.com/x"),
      false,
    );
    assert.equal(
      isUsableLeadItem("Oracle stock jumps 7% on earnings beat", "https://www.cnbc.com/oracle"),
      true,
    );
  });
});

describe("titlesAreNearDuplicate", () => {
  it("catches rewritten chip-export fixture titles", () => {
    const fixture = "u s chip equipment makers report a jump in export licenses for allied fabs";
    const rewrite = "us chip equipment makers see surge in export licenses for allied fabs";
    assert.equal(titlesAreNearDuplicate(fixture, rewrite), true);
  });

  it("does not collapse distinct semiconductor stories", () => {
    assert.equal(
      titlesAreNearDuplicate(
        "u s chip equipment makers report a jump in export licenses for allied fabs",
        "asml high na queue stretches into 2028 as u s logic fabs bid for scarce tools",
      ),
      false,
    );
  });
});
