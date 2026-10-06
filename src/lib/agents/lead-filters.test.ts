import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  distinctiveEntityTokens,
  intakeSkipReason,
  isEnglishCopy,
  isMostlyEnglishTitle,
  isPrNewswireFeed,
  isUsableLeadItem,
  leadPublishedSkipReason,
  prNewswireSkipReason,
  topicsShareEntities,
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

  it("rejects translated PR Newswire headlines before a model call", () => {
    assert.equal(
      isUsableLeadItem(
        "Arcadis profundiza su colaboración con Autodesk",
        "https://www.prnewswire.com/news-releases/arcadis-es",
      ),
      false,
    );
    assert.equal(
      isUsableLeadItem(
        "Arcadis renforce sa collaboration avec Autodesk afin d'accélérer la mise en œuvre de solutions basées sur l'IA et les données pour ses clients",
        "https://www.prnewswire.com/news-releases/arcadis-fr",
        "Arcadis a annoncé le renforcement de sa collaboration avec Autodesk pour les clients.",
      ),
      false,
    );
    assert.equal(
      isUsableLeadItem(
        "MAYPHARM stellt HYALMASS AQUATOX vor, eine multiaktive Hautpflege der nächsten Generation für den globalen Markt für ästhetische Medizin",
        "https://www.prnewswire.com/news-releases/maypharm-de",
      ),
      false,
    );
    assert.equal(
      isUsableLeadItem(
        "Arcadis deepens Autodesk collaboration to accelerate AI and data-led delivery for clients",
        "https://www.prnewswire.com/news-releases/arcadis-en",
      ),
      true,
    );
  });
});

describe("isEnglishCopy", () => {
  it("keeps an English story that names Angélica Dass once", () => {
    const copy = `Arcadis deepens its work with Autodesk. The company said the collaboration will use project data, and photographer Angelica Dass was not involved. `.repeat(8);
    assert.equal(isEnglishCopy(`${copy} The portrait is by Angélica Dass.`), true);
  });

  it("rejects a Slovak wire body", () => {
    const copy =
      "Spoločnosť Envision Energy oznámila, že podpísala dohodu so slovenskou vládou na výstavbu nového závodu. Podľa dohody bude projekt financovaný z verejných zdrojov a spoločnosť bude spolupracovať s miestnymi partnermi. Ministerstvo hospodárstva uviedlo, že výstavba sa začne budúci rok a že ide o dôležitý krok pre energetiku.";
    assert.equal(isEnglishCopy(copy), false);
  });
});

describe("topicsShareEntities", () => {
  const arcadisEn =
    "Arcadis deepens Autodesk collaboration to accelerate AI and data-led delivery for clients";
  const arcadisFr =
    "Arcadis renforce sa collaboration avec Autodesk afin d'accélérer la mise en œuvre de solutions basées sur l'IA et les données pour ses clients";
  const arcadisEs = "Arcadis profundiza su colaboración con Autodesk";
  const maypharmEn =
    "MAYPHARM Unveils HYALMASS AQUATOX, a Next-Generation Multi-Active Skin Solution for the Global Aesthetic Market";
  const maypharmDe =
    "MAYPHARM stellt HYALMASS AQUATOX vor, eine multiaktive Hautpflege der nächsten Generation für den globalen Markt für ästhetische Medizin";

  it("treats Arcadis EN/FR/ES and MAYPHARM EN/DE as one story each", () => {
    assert.equal(topicsShareEntities(arcadisEn, arcadisFr), true);
    assert.equal(topicsShareEntities(arcadisEn, arcadisEs), true);
    assert.equal(topicsShareEntities(arcadisFr, arcadisEs), true);
    assert.equal(topicsShareEntities(maypharmEn, maypharmDe), true);
    assert.ok(distinctiveEntityTokens(arcadisEn).includes("arcadis"));
    assert.ok(distinctiveEntityTokens(arcadisEn).includes("autodesk"));
    assert.ok(distinctiveEntityTokens(maypharmDe).includes("maypharm"));
    assert.ok(distinctiveEntityTokens(maypharmDe).includes("hyalmass"));
  });

  it("does not glue a different Arcadis deal or an unrelated earnings story", () => {
    assert.equal(
      topicsShareEntities(arcadisEn, "Arcadis sells its water business to Veolia"),
      false,
    );
    assert.equal(
      topicsShareEntities(
        "Oracle stock jumps 7% on earnings beat",
        "Nvidia unveils a new data center chip for cloud buyers",
      ),
      false,
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

  it("drops law-firm solicitations and investor-day announcements before the writer", () => {
    const bfa =
      "PRTH Deal Notice: Priority Technology's $8.05 per Share Take-Private Merger Under Investigation - Shareholders Encouraged to Contact BFA Law";
    const bfaSummary =
      "Leading securities law firm Bleichmar Fonti & Auld LLP announces that it is investigating the pending take-private. Shareholders are encouraged to contact the firm.";
    assert.match(prNewswireSkipReason(bfa, bfaSummary), /law-firm shareholder notice/);
    assert.match(
      prNewswireSkipReason(
        "Priority Technology Legal Alert: Investors are Notified of the Ongoing Investigation into the Take Private Deal",
        "Contact BFA Law to discuss your rights.",
      ),
      /law-firm shareholder notice/,
    );
    assert.match(
      prNewswireSkipReason(
        "ROSEN, A LEADING LAW FIRM, Encourages Solidion Technology Investors to Secure Counsel in a Securities Class Action",
      ),
      /law-firm shareholder notice/,
    );
    assert.match(
      prNewswireSkipReason(
        "Levi & Korsky Notifies Shareholders of Polar Power of a Class Action Lawsuit and Lead Plaintiff Deadline",
      ),
      /law-firm shareholder notice/,
    );
    assert.match(
      prNewswireSkipReason(
        "Pomerantz Law Firm Announces a Shareholder Investigation of Priority Technology on Behalf of Investors",
        "The notice describes the company's proposed acquisition.",
      ),
      /law-firm shareholder notice/,
    );
    assert.match(
      prNewswireSkipReason("SeAH Besteel Holdings to Host Investor Day on U.S. Steel Production"),
      /investor day announcement/,
    );
    assert.match(
      prNewswireSkipReason("Acme Hosts Its 2026 Investor Day and Reaffirms Full-Year Earnings Guidance"),
      /investor day announcement/,
    );

    assert.equal(prNewswireSkipReason("Acme agrees to acquire Beta for $2 billion"), null);
    assert.equal(prNewswireSkipReason("FTC sues to block the Mega Retail merger"), null);
    assert.equal(prNewswireSkipReason("European Commission opens an antitrust review of the Mega Retail merger"), null);
    assert.equal(prNewswireSkipReason("Acme closes a $400 million term loan"), null);
    assert.equal(
      prNewswireSkipReason(
        "Acme agrees to acquire Beta for $2 billion and will present the deal at its investor day",
      ),
      null,
    );
    assert.equal(
      prNewswireSkipReason("Acme to Host Investor Day to Announce a $400 Million Term Loan"),
      null,
    );

    assert.match(
      intakeSkipReason({
        ...pr,
        title: bfa,
        summary: bfaSummary,
        publishedAt: FRESH,
        now: NOW,
      }) ?? "",
      /law-firm shareholder notice/,
    );
    assert.equal(
      intakeSkipReason({
        sourceName: "CNBC Finance",
        sourceUrl: "https://www.cnbc.com/finance/",
        title: bfa,
        summary: bfaSummary,
        publishedAt: FRESH,
        now: NOW,
      }),
      null,
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
