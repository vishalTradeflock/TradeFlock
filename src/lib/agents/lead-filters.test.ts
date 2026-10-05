import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  intakeSkipReason,
  isMostlyEnglishTitle,
  isPrNewswireFeed,
  isUsableLeadItem,
  leadPublishedSkipReason,
  prNewswireSkipReason,
  titlesAreNearDuplicate,
} from "./lead-filters.ts";

const NOW = Date.parse("2026-10-05T14:00:00.000Z");
const FRESH = Date.parse("2026-10-05T05:00:00.000Z");
const STALE = Date.parse("2026-09-16T12:00:00.000Z");

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

describe("48-hour freshness", () => {
  it("skips a missing feed timestamp and a source older than 48h", () => {
    assert.equal(leadPublishedSkipReason(null, NOW), null);
    assert.equal(leadPublishedSkipReason("  ", NOW), null);
    assert.equal(leadPublishedSkipReason("unknown", NOW), "source date unknown");
    assert.equal(leadPublishedSkipReason("not-a-date", NOW), "source date unknown");
    assert.equal(
      intakeSkipReason({
        sourceName: "CNBC Economy",
        sourceUrl: "https://search.cnbc.com/rs/search/combinedcms/view.xml?id=20910258",
        title: "UK inflation stays hot as diesel prices jump",
        summary: "September figures.",
        publishedAt: 0,
        now: NOW,
      }),
      "source date unknown",
    );
    assert.equal(
      intakeSkipReason({
        sourceName: "CNBC Economy",
        sourceUrl: "https://www.cnbc.com/economy/",
        title: "UK inflation stays hot as diesel prices jump",
        summary: "Published in September.",
        publishedAt: STALE,
        now: NOW,
      }),
      "source older than 48h",
    );
    assert.equal(
      intakeSkipReason({
        sourceName: "CNBC Economy",
        sourceUrl: "https://www.cnbc.com/economy/",
        title: "Aging populations pressure public finances",
        summary: "Moody's note.",
        publishedAt: FRESH,
        now: NOW,
      }),
      null,
    );
  });
});

describe("PR Newswire intake", () => {
  const pr = {
    sourceName: "PR Newswire M&A",
    sourceUrl: "https://www.prnewswire.com/rss/mergers-and-acquisitions-list.rss",
  };

  it("keeps deals, financing, and antitrust and drops soft releases", () => {
    assert.equal(isPrNewswireFeed(pr.sourceName, pr.sourceUrl), true);
    assert.equal(isPrNewswireFeed("CNBC Economy", "https://www.cnbc.com/economy/"), false);

    assert.equal(
      prNewswireSkipReason("Acme agrees to acquire Beta for $2 billion"),
      null,
    );
    assert.equal(
      prNewswireSkipReason("FTC sues to block the Mega Retail merger"),
      null,
    );
    assert.equal(prNewswireSkipReason("Acme closes a $400 million term loan"), null);
    assert.equal(prNewswireSkipReason("Beta announces a Series C financing round"), null);
    assert.equal(
      prNewswireSkipReason("Dermatology chain agrees to acquire 12 clinics"),
      null,
    );
    assert.equal(
      prNewswireSkipReason("Acme launches a tender offer to acquire Beta"),
      null,
    );
    assert.equal(prNewswireSkipReason("Acme invests $50 million for a minority stake in Beta"), null);

    assert.match(prNewswireSkipReason("Shelter pets spread holiday cheer"), /awareness or promotional campaign/);
    assert.match(
      prNewswireSkipReason("Landmarks glow orange for bullying prevention"),
      /awareness or promotional campaign/,
    );
    assert.match(
      prNewswireSkipReason("Golden State Dermatology expands into Utah"),
      /local clinic or practice opening/,
    );
    assert.match(prNewswireSkipReason("Farm4Profit receives a national award"), /award or recognition/);
    assert.match(prNewswireSkipReason("Inner Circle recognizes Jordan Hale"), /award or recognition/);
    assert.match(
      prNewswireSkipReason("Payroll firm releases September employment data"),
      /payroll or employment data dump/,
    );
    assert.match(
      prNewswireSkipReason("Nestle Toll House launches an advent calendar"),
      /promotional launch/,
    );
    assert.match(
      prNewswireSkipReason("Digital Education Market worth $115.39 billion by 2031"),
      /promotional research/,
    );
    assert.match(
      prNewswireSkipReason("Sport Clips invites clients to a scholarship campaign"),
      /awareness or promotional campaign/,
    );
    assert.match(
      prNewswireSkipReason("Acme plans to acquire customers with a new app"),
      /no deal, financing, or regulatory news/,
    );
  });

  it("does not apply the soft-PR rule to other wires", () => {
    assert.equal(
      intakeSkipReason({
        sourceName: "CNBC Finance",
        sourceUrl: "https://www.cnbc.com/finance/",
        title: "Farm4Profit receives a national award",
        summary: "A recognition story on the tape.",
        publishedAt: FRESH,
        now: NOW,
      }),
      null,
    );
    assert.match(
      intakeSkipReason({
        ...pr,
        title: "Inner Circle recognizes Jordan Hale",
        summary: "An awards release.",
        publishedAt: FRESH,
        now: NOW,
      }) ?? "",
      /soft PR Newswire/,
    );
  });

  it("is wired into feed intake and the pre-write pipeline", () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)));
    const leads = readFileSync(resolve(root, "leads.ts"), "utf8");
    const pipeline = readFileSync(resolve(root, "pipeline.ts"), "utf8");
    assert.match(leads, /intakeSkipReason/);
    assert.match(pipeline, /leadPublishedSkipReason/);
  });
});
