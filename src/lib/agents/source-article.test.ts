import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { ARTICLE_MIN_WORDS } from "./wire-hygiene.ts";
import { writerLeadInstructions } from "./wire-hygiene.ts";
import {
  SOURCE_MIN_WORDS,
  appendArticleText,
  classifyExtractedSource,
  countSourceWords,
  extractSourceArticle,
  fetchSourceArticle,
  selectWritableLeads,
  trimSourceText,
} from "./source-article.ts";

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
    assert.match(instructions, /Report only facts written there/);
    assert.match(instructions, /Do not pad/);
    assert.match(instructions, /Article text/);
    assert.equal(ARTICLE_MIN_WORDS, 550);
    assert.equal(SOURCE_MIN_WORDS, 350);
  });
});
