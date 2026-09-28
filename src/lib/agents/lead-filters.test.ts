import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  distinctiveEntityTokens,
  isEnglishCopy,
  isMostlyEnglishTitle,
  isUsableLeadItem,
  topicsShareEntities,
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
