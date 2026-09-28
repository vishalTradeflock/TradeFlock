import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { ARTICLE_MIN_WORDS } from "./wire-hygiene.ts";
import { writerLeadInstructions } from "./wire-hygiene.ts";
import {
  SOURCE_MIN_WORDS,
  SOURCE_TOPUP_CORE_MIN,
  appendArticleText,
  classifyExtractedSource,
  countSourceWords,
  extractSourceArticle,
  fetchSourceArticle,
  mergeSupplementalSource,
  prepareSourceText,
  selectWritableLeads,
  sourceIsSufficient,
  trimSourceText,
} from "./source-article.ts";
import { unusedSourceParagraphs } from "./wire-hygiene.ts";

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");
const articleHtml = readFileSync(resolve(fixtureDir, "source-article.html"), "utf8");
const paywallHtml = readFileSync(resolve(fixtureDir, "paywall.html"), "utf8");

function responseFor(html: string, status = 200, contentType = "text/html; charset=utf-8"): Response {
  return new Response(html, {
    status,
    headers: { "content-type": contentType },
  });
}

function longArticleHtml(words: number): string {
  const paragraphs: string[] = [];
  let index = 0;
  while (countSourceWords(paragraphs.join(" ")) < words) {
    index += 1;
    paragraphs.push(
      `Section ${index}. Acme reported revenue of $9.1 billion and kept its Chicago headquarters after shareholder vote number ${index}.`,
    );
  }
  return `<!DOCTYPE html><html><head>
    <meta property="og:image" content="https://cdn.example.com/acme-northwind.jpg" />
    </head><body><nav><p>Markets navigation that must stay out of the story.</p></nav>
    <article><h1>Acme buys Northwind</h1>${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("")}</article>
    <footer><p>Copyright Example Media evening newsletter signup.</p></footer></body></html>`;
}

describe("extractSourceArticle", () => {
  it("keeps article paragraphs in order and drops nav, footer, and related links", () => {
    const extracted = extractSourceArticle(articleHtml, "https://www.example.com/acme-northwind");
    const first = extracted.text.indexOf("agreed to buy Northwind");
    const second = extracted.text.indexOf("Lena Ortiz");
    const third = extracted.text.indexOf("Breakup fee and timing");
    const fourth = extracted.text.indexOf("$210 million breakup fee");
    assert.ok(first >= 0 && second > first && third > second && fourth > third);
    assert.equal(extracted.text.includes("Technology desk navigation"), false);
    assert.equal(extracted.text.includes("Widget makers"), false);
    assert.equal(extracted.text.includes("evening newsletter"), false);
    assert.equal(extracted.ogImageUrl, "https://cdn.example.com/acme-northwind.jpg");
    assert.ok(extracted.wordCount > 80);
    assert.ok(extracted.wordCount < SOURCE_MIN_WORDS);
  });

  it("treats a subscribe wall as blocked and a short clean article as thin", () => {
    const paywall = extractSourceArticle(paywallHtml, "https://www.example.com/locked");
    assert.equal(
      classifyExtractedSource({
        status: 200,
        wordCount: paywall.wordCount,
        text: paywall.text,
        html: paywallHtml,
        contentType: "text/html",
      }),
      "blocked",
    );
    const article = extractSourceArticle(articleHtml, "https://www.example.com/acme-northwind");
    assert.equal(
      classifyExtractedSource({
        status: 200,
        wordCount: article.wordCount,
        text: article.text,
        html: articleHtml,
        contentType: "text/html",
      }),
      "thin",
    );
    assert.equal(
      classifyExtractedSource({
        status: 200,
        wordCount: SOURCE_MIN_WORDS - 1,
        text: "Acme reported revenue of $9.1 billion in Chicago last year.",
        html: "<p>Acme reported revenue of $9.1 billion in Chicago last year.</p>",
        contentType: "text/html",
      }),
      "thin",
    );
    assert.equal(
      classifyExtractedSource({
        status: 200,
        wordCount: SOURCE_MIN_WORDS,
        text: "x ".repeat(SOURCE_MIN_WORDS),
        html: "<p>story</p>",
        contentType: "text/html",
      }),
      "ready",
    );
  });
});

describe("fetchSourceArticle", () => {
  it("skips timeouts, blocks, and thin pages, and returns a full article with its og:image", async () => {
    const timedOut = await fetchSourceArticle("https://www.example.com/slow", async () => {
      throw Object.assign(new Error("The operation was aborted"), { name: "TimeoutError" });
    });
    assert.equal(timedOut.ok, false);
    if (!timedOut.ok) {
      assert.equal(timedOut.reason, "fetch_failed");
      assert.match(timedOut.detail, /timed out/);
    }

    const forbidden = await fetchSourceArticle("https://www.example.com/nope", async () =>
      responseFor("denied", 403),
    );
    assert.equal(forbidden.ok, false);
    if (!forbidden.ok) assert.equal(forbidden.reason, "blocked");

    const thin = await fetchSourceArticle("https://www.example.com/short", async () =>
      responseFor(articleHtml),
    );
    assert.equal(thin.ok, false);
    if (!thin.ok) {
      assert.equal(thin.reason, "thin");
      assert.ok(thin.wordCount < SOURCE_MIN_WORDS);
    }

    const readyHtml = longArticleHtml(SOURCE_MIN_WORDS + 40);
    const ready = await fetchSourceArticle("https://www.example.com/full", async () => responseFor(readyHtml));
    assert.equal(ready.ok, true);
    if (ready.ok) {
      assert.ok(ready.wordCount >= SOURCE_MIN_WORDS);
      assert.equal(ready.ogImageUrl, "https://cdn.example.com/acme-northwind.jpg");
      assert.equal(ready.text.includes("Markets navigation"), false);
    }
  });
});

describe("selectWritableLeads", () => {
  it("skips thin and blocked candidates and keeps writing until the batch is full", async () => {
    const leads = ["a", "b", "c", "d", "e", "f"].map((id) => ({
      topic: id,
      rawSource: `Source: CNBC\nURL: https://www.example.com/${id}\n\nHeadline: Story ${id}`,
      sourceUrl: `https://www.example.com/${id}`,
    }));
    const seen: string[] = [];
    const selected = await selectWritableLeads(leads, {
      limit: 2,
      concurrency: 1,
      fetchArticle: async (url) => {
        seen.push(url);
        if (url.endsWith("/a") || url.endsWith("/b")) {
          return { ok: false, reason: "thin", detail: "120 words of source text (need ≥350)", wordCount: 120 };
        }
        if (url.endsWith("/c")) {
          return { ok: false, reason: "blocked", detail: "HTTP 403", wordCount: 0 };
        }
        if (url.endsWith("/f")) {
          return { ok: false, reason: "fetch_failed", detail: "timed out", wordCount: 0 };
        }
        return {
          ok: true,
          text: "Acme agreed to buy Northwind for $4.2 billion. ".repeat(40),
          wordCount: 400,
          title: "Acme",
          ogImageUrl: "https://cdn.example.com/acme-northwind.jpg",
          finalUrl: url,
        };
      },
    });

    assert.deepEqual(selected.leads.map((lead) => lead.topic), ["d", "e"]);
    assert.equal(selected.stopped, "limit");
    assert.equal(seen.includes("https://www.example.com/f"), false);
    assert.equal(selected.stats.skippedThin, 2);
    assert.equal(selected.stats.skippedBlocked, 1);
    assert.equal(selected.stats.fetched, 4);
    assert.deepEqual(
      selected.skipped.map((skip) => [skip.lead.topic, skip.reason, skip.persist]),
      [
        ["a", "thin", true],
        ["b", "thin", true],
        ["c", "blocked", true],
      ],
    );
    assert.match(selected.leads[0]?.rawSource ?? "", /Article text/);
    assert.equal(selected.leads[0]?.sourcePageFetched, true);
    assert.equal(selected.leads[0]?.sourceOgImageUrl, "https://cdn.example.com/acme-northwind.jpg");
  });

  it("does not fetch when the time budget is already too low", async () => {
    let calls = 0;
    const selected = await selectWritableLeads(
      [{ topic: "later", rawSource: "Source: CNBC", sourceUrl: "https://www.example.com/later" }],
      {
        limit: 2,
        timeRemainingMs: () => 1_000,
        minBudgetMs: 60_000,
        fetchArticle: async () => {
          calls += 1;
          return { ok: false, reason: "fetch_failed", detail: "should not run", wordCount: 0 };
        },
      },
    );
    assert.equal(calls, 0);
    assert.equal(selected.stopped, "time");
    assert.equal(selected.leads.length, 0);
    assert.equal(selected.deferred.length, 1);
  });
});

describe("source text budget", () => {
  it("trims on a paragraph boundary and tells the writer not to pad", () => {
    const paragraphs = Array.from({ length: 30 }, (_, index) => `Paragraph ${index} stays intact.`.repeat(20));
    const trimmed = trimSourceText(paragraphs.join("\n\n"), 500);
    assert.ok(trimmed.length <= 500);
    assert.equal(trimmed.startsWith("Paragraph 0"), true);
    assert.equal(trimmed.includes("Paragraph 29"), false);

    const notes = appendArticleText("Source: CNBC\nURL: https://www.cnbc.com/story", "Acme agreed to buy Northwind.");
    const instructions = writerLeadInstructions(
      { topic: "Acme", category: "markets", rawSource: notes, sourceUrl: "https://www.cnbc.com/story" },
      "",
    );
    assert.match(instructions, /every newsworthy fact/i);
    assert.match(instructions, /Do not pad/);
    assert.match(instructions, /650-to-850-word/);
    assert.doesNotMatch(instructions, /HOLD the lead/);
    assert.match(instructions, /Article text/);
    assert.equal(ARTICLE_MIN_WORDS, 550);
    assert.equal(SOURCE_MIN_WORDS, 450);
  });
});

function words(count: number, sentence: string): string {
  const once = sentence.trim();
  const unit = countSourceWords(once);
  return Array.from({ length: Math.ceil(count / unit) }, () => once).join(" ");
}

describe("prepareSourceText", () => {
  it("drops safe harbor, contacts, and the SOURCE line, and does not count About toward the gate", () => {
    const core = words(
      470,
      "Moyom Biotech said Cathay Capital led a financing round that closed in New York on Monday.",
    );
    const about = words(160, "Moyom Biotech develops therapies for rare metabolic disease and employs scientists in Boston.");
    const raw = [
      "NEW YORK, Sept. 28, 2026 /PRNewswire/ -- " + core,
      "About Moyom Biotech",
      about,
      "Forward-Looking Statements",
      "This press release contains forward-looking statements that are not facts.",
      "Media Contact",
      "Jane Doe jane@moyom.example",
      "SOURCE Moyom Biotech",
      "View original content to download multimedia: https://www.prnewswire.com/moyom",
    ].join("\n\n");
    const prepared = prepareSourceText(raw);
    assert.ok(prepared.coreWords >= SOURCE_MIN_WORDS);
    assert.ok(prepared.backgroundWords > 0);
    assert.equal(prepared.core.includes("Forward-Looking"), false);
    assert.equal(prepared.core.includes("Jane Doe"), false);
    assert.equal(prepared.core.includes("SOURCE Moyom"), false);
    assert.equal(prepared.core.includes("/PRNewswire/"), false);
    assert.equal(prepared.core.includes("View original content"), false);
    assert.match(prepared.text, /Company background/);
    assert.match(prepared.text, /rare metabolic disease/);
    assert.equal(sourceIsSufficient(prepared), true);
  });

  it("keeps a sentence that happens to start with a number after About", () => {
    const prepared = prepareSourceText(
      "Ortiz said Acme will keep the brand. About 1,200 Northwind employees work at that office, the company said.",
    );
    assert.match(prepared.core, /About 1,200 Northwind employees/);
    assert.equal(prepared.background, "");
  });

  it("tops a thin news peg up with the labelled About section instead of calling it sufficient on its own", () => {
    const core = words(SOURCE_TOPUP_CORE_MIN + 20, "TrendAI reported a contract with a hospital group in Chicago.");
    const about = words(300, "TrendAI builds clinical software and was founded by engineers in Austin.");
    const prepared = prepareSourceText(`${core}\n\nAbout TrendAI\n\n${about}`);
    assert.ok(prepared.coreWords < SOURCE_MIN_WORDS);
    assert.ok(prepared.coreWords >= SOURCE_TOPUP_CORE_MIN);
    assert.equal(sourceIsSufficient(prepared), true);
    assert.match(prepared.text, /Company background/);
  });

  it("stays thin when the news peg is only a blurb plus a long About", () => {
    const core = words(80, "TrendAI won an award.");
    const about = words(400, "TrendAI builds clinical software and was founded by engineers in Austin.");
    const prepared = prepareSourceText(`${core}\n\nAbout TrendAI\n\n${about}`);
    assert.ok(prepared.coreWords < SOURCE_TOPUP_CORE_MIN);
    assert.equal(sourceIsSufficient(prepared), false);
  });
});

describe("second source top-up", () => {
  it("merges one other English source on the same story when the primary page is thin", async () => {
    const primary = words(220, "Arcadis said the Autodesk work covers project data in Amsterdam.");
    const extra = words(260, "Autodesk said Arcadis will use Assistant on design reviews for clients.");
    const selected = await selectWritableLeads(
      [
        {
          topic: "Arcadis deepens Autodesk collaboration to accelerate AI and data-led delivery for clients",
          rawSource: "Source: PR Newswire\nURL: https://www.example.com/arcadis-en\n\nHeadline: Arcadis",
          sourceUrl: "https://www.example.com/arcadis-en",
          supplementUrl: "https://www.example.com/arcadis-trade",
        },
      ],
      {
        limit: 1,
        concurrency: 1,
        fetchArticle: async (url) => {
          const text = url.endsWith("/arcadis-en") ? primary : extra;
          return {
            ok: false,
            reason: "thin",
            detail: "thin",
            wordCount: countSourceWords(text),
            text,
            title: "Arcadis",
            ogImageUrl: null,
          };
        },
      },
    );
    assert.equal(selected.leads.length, 1);
    assert.match(selected.leads[0]?.rawSource ?? "", /Additional reporting/);
    assert.equal(selected.stats.skippedThin, 0);
    assert.ok(countSourceWords(mergeSupplementalSource(primary, extra)) >= SOURCE_MIN_WORDS);
  });

  it("skips a non-English article before any model call", async () => {
    const spanish = "Arcadis profundiza su colaboración con Autodesk para acelerar el uso de la inteligencia artificial y los datos en los proyectos de sus clientes. ".repeat(40);
    const selected = await selectWritableLeads(
      [
        {
          topic: "Arcadis profundiza su colaboración con Autodesk",
          rawSource: "Source: PR Newswire",
          sourceUrl: "https://www.example.com/arcadis-es",
        },
      ],
      {
        limit: 1,
        fetchArticle: async () => ({
          ok: false,
          reason: "non_english",
          detail: "source article is not English",
          wordCount: countSourceWords(spanish),
          text: spanish,
        }),
      },
    );
    assert.equal(selected.leads.length, 0);
    assert.equal(selected.stats.skippedNonEnglish, 1);
    assert.equal(selected.skipped[0]?.persist, true);
    assert.equal(selected.skipped[0]?.reason, "non_english");
  });
});

describe("unusedSourceParagraphs", () => {
  it("returns source paragraphs the draft has not used", () => {
    const source = [
      "Arcadis said the Autodesk collaboration covers project data and design reviews in Amsterdam for hospital clients.",
      "The companies said a quality-control task that took five days now takes about half a day after the automation work.",
    ].join("\n\n");
    const draft = "<p>Arcadis said the Autodesk collaboration covers project data and design reviews in Amsterdam for hospital clients.</p>";
    const unused = unusedSourceParagraphs(source, draft);
    assert.match(unused, /half a day/);
    assert.equal(unused.includes("hospital clients"), false);
  });
});
