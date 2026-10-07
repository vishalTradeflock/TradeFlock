import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { checkVerdict, totalPoints, type Scores } from "./scorecard.ts";
import { buildSignal, clusterSignals, wordCount, SIGNAL_CARD_MAX_WORDS } from "./signals.ts";
import { can, roleForToken, NEWSROOM_ROLES } from "./roles.ts";
import {
  aiDisclosureText,
  articleAuthorMetadata,
  articleBylinePresentation,
  authorStructuredData,
  isHumanAuthor,
} from "./authorship.ts";
import { wireMode } from "./wire-mode.ts";
import { toNewsArticleHref, rewriteInternalArticleHrefs } from "../sanitize-article-body.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const strong: Scores = {
  added_value: 4, accuracy: 5, sourcing: 4, news_value: 4, context: 4, reader_value: 4, search_fit: 4, style: 4,
};

describe("scorecard v1", () => {
  it("weights 0-5 criteria to 100 points", () => {
    const max: Scores = { added_value: 5, accuracy: 5, sourcing: 5, news_value: 5, context: 5, reader_value: 5, search_fit: 5, style: 5 };
    assert.equal(totalPoints(max), 100);
    assert.equal(totalPoints(strong), 84);
  });
  it("PUBLISH needs >=80, added value >=3, accuracy 5/5, no hard fails", () => {
    assert.deepEqual(checkVerdict({ decision: "PUBLISH", scores: strong, hardFailsUnresolved: [] }), { ok: true });
    assert.equal(checkVerdict({ decision: "PUBLISH", scores: { ...strong, accuracy: 4 }, hardFailsUnresolved: [] }).ok, false);
    assert.equal(checkVerdict({ decision: "PUBLISH", scores: { ...strong, added_value: 2, sourcing: 5, context: 5, reader_value: 5 }, hardFailsUnresolved: [] }).ok, false);
    assert.equal(checkVerdict({ decision: "PUBLISH", scores: { ...strong, context: 2, reader_value: 2 }, hardFailsUnresolved: [] }).ok, false);
    assert.equal(checkVerdict({ decision: "PUBLISH", scores: strong, hardFailsUnresolved: ["HF1"] }).ok, false);
  });
  it("HF9 maps to REVISE only", () => {
    assert.equal(checkVerdict({ decision: "PUBLISH", scores: strong, hardFailsUnresolved: ["HF9"] }).ok, false);
    assert.equal(checkVerdict({ decision: "REJECT", scores: strong, hardFailsUnresolved: ["HF9"] }).ok, false);
    assert.equal(checkVerdict({ decision: "REVISE", scores: strong, hardFailsUnresolved: ["HF9"] }).ok, true);
  });
  it("cap override only for breaking news", () => {
    assert.equal(checkVerdict({ decision: "PUBLISH", scores: strong, hardFailsUnresolved: [], capOverrideReason: "x" }).ok, false);
    assert.equal(checkVerdict({ decision: "PUBLISH", scores: strong, hardFailsUnresolved: [], isBreaking: true, capOverrideReason: "Fed emergency cut" }).ok, true);
  });
});

describe("signal desk", () => {
  const now = Date.parse("2026-10-07T12:00:00Z");
  const base = { sourceName: "CNBC Finance", publishedAtMs: now - 3600_000, desk: "markets" as const };
  it("builds a short card, not an article", () => {
    const s = buildSignal({ ...base, title: "Acme Corp agrees to buy Widget Holdings for $4 billion", summary: "Acme Corp said it agreed to buy Widget Holdings. ".repeat(40), sourceUrl: "https://www.cnbc.com/a" }, "acme", now);
    assert.ok(wordCount(s.card) <= SIGNAL_CARD_MAX_WORDS + 1);
    assert.equal(s.eventType, "m_and_a");
    assert.equal(s.suggestedDesk, "ma");
    assert.equal(s.materiality, "high");
    assert.ok(s.entities.includes("Acme"));
  });
  it("scores EDGAR 8-K filings as primary sources", () => {
    const s = buildSignal({ ...base, sourceName: "SEC EDGAR 8-K", title: "8-K - VAALCO ENERGY INC /DE/ (0000894627) (Filer)", summary: "Filed: 2026-10-07 Item 2.02: Results of Operations and Financial Condition", sourceUrl: "https://www.sec.gov/Archives/edgar/data/894627/x-index.htm" }, "vaalco", now);
    assert.equal(s.sourceType, "primary_filing");
    assert.equal(s.eventType, "earnings");
    const pr = buildSignal({ ...base, title: "Acme announces new partnership", summary: "Acme announced today a partnership.", sourceUrl: "https://www.prnewswire.com/x" }, "pr", now);
    assert.equal(pr.sourceType, "press_release");
    assert.ok(s.score > pr.score);
  });
  it("clusters the same entity+event from different outlets", () => {
    const a = buildSignal({ ...base, title: "Acme Corp to acquire Widget in $4 billion deal", summary: "", sourceUrl: "https://a.com/1" }, "a", now);
    const b = buildSignal({ ...base, sourceName: "Reuters", title: "Acme Corp agrees to buy Widget", summary: "", sourceUrl: "https://b.com/2" }, "b", now);
    assert.equal(a.clusterKey, b.clusterKey);
    const { kept, duplicates } = clusterSignals([a, b]);
    assert.equal(kept.length, 1);
    assert.equal(duplicates.length, 1);
  });
});

describe("WIRE_MODE", () => {
  it("defaults to signals", () => {
    assert.equal(wireMode({}), "signals");
    assert.equal(wireMode({ WIRE_MODE: "bogus" }), "signals");
    assert.equal(wireMode({ WIRE_MODE: "publish" }), "publish");
  });
});

describe("newsroom roles", () => {
  const env = { [NEWSROOM_ROLES.desk_tech]: "t".repeat(40), [NEWSROOM_ROLES.wire_editor]: "w".repeat(40), [NEWSROOM_ROLES.publisher]: "p".repeat(40) };
  it("maps tokens to roles and rejects unknown/short tokens", () => {
    assert.equal(roleForToken(`Bearer ${"t".repeat(40)}`, env), "desk_tech");
    assert.equal(roleForToken(`Bearer ${"x".repeat(40)}`, env), null);
    assert.equal(roleForToken("Bearer short", env), null);
    assert.equal(roleForToken(null, env), null);
  });
  it("only the Wire Editor writes verdicts; only the publisher publishes", () => {
    for (const role of Object.keys(NEWSROOM_ROLES) as (keyof typeof NEWSROOM_ROLES)[]) {
      assert.equal(can(role, "verdict"), role === "wire_editor", role);
      assert.equal(can(role, "publish"), role === "publisher", role);
    }
    assert.equal(can("desk_tech", "packet"), true);
    assert.equal(can("wire_editor", "packet"), false);
  });
});

describe("authorship (F, G, H)", () => {
  const canon = (p: string) => `https://www.tradeflock.net${p}`;
  it("persona bylines are never human authors", () => {
    assert.equal(isHumanAuthor({ slug: "james-whitaker", name: "James Whitaker" }), false);
    assert.equal(isHumanAuthor({ slug: "anyone", author_type: "persona" }), false);
    assert.equal(isHumanAuthor({ slug: "tradeflock-newsroom" }), false);
    assert.equal(isHumanAuthor({ slug: "tanishka-jain", name: "Tanishka Jain" }), true);
  });
  it("names the article byline as a Person, including desk personas", () => {
    const personas: Array<[string, string, string?]> = [
      ["sophia-brennan", "Sophia Brennan", "Wall Street Correspondent"],
      ["marcus-chen", "Marcus Chen", "Leadership & Policy Correspondent"],
      ["elena-vasquez", "Elena Vasquez", "Senior Markets Correspondent"],
      ["james-whitaker", "James Whitaker", "Technology Editor"],
      ["priya-nair", "Priya Nair", "Finance Reporter"],
      ["tanishka-jain", "Tanishka Jain"],
    ];
    for (const [slug, name, title] of personas) {
      const node = authorStructuredData({ slug, name, title, author_type: "persona" }, canon);
      assert.equal(node["@type"], "Person", slug);
      assert.equal(node.name, name, slug);
      assert.equal(node.url, `https://www.tradeflock.net/author/${slug}`, slug);
      if (title) assert.equal(node.jobTitle, title, slug);
      else assert.equal(node.jobTitle, undefined, slug);
      assert.equal(JSON.stringify(node).includes("TradeFlock Newsroom"), false);
    }
    const meta = articleAuthorMetadata(
      { slug: "james-whitaker", name: "James Whitaker", title: "Technology Editor" },
      canon,
    );
    assert.deepEqual(meta, {
      name: "James Whitaker",
      url: "https://www.tradeflock.net/author/james-whitaker",
    });
  });
  it("falls back to Organization TradeFlock when the article has no byline author", () => {
    assert.deepEqual(authorStructuredData(null, canon), {
      "@type": "Organization",
      name: "TradeFlock",
      url: "https://www.tradeflock.net/",
    });
    assert.deepEqual(authorStructuredData({ name: "  " }, canon)["@type"], "Organization");
    const newsroom = authorStructuredData(
      {
        slug: "tradeflock-newsroom",
        name: "TradeFlock Newsroom",
        title: "AI-assisted newsroom",
        bio: "AI-assisted reporting by the TradeFlock desks.",
        author_type: "organization",
      },
      canon,
    );
    assert.deepEqual(newsroom, {
      "@type": "Organization",
      name: "TradeFlock",
      url: "https://www.tradeflock.net/",
    });
    const presented = articleBylinePresentation({
      slug: "tradeflock-newsroom",
      name: "TradeFlock Newsroom",
      title: "AI-assisted newsroom",
      bio: "AI-assisted reporting by the TradeFlock desks.",
    });
    assert.equal(presented.name, "TradeFlock Editorial Desk");
    assert.equal(presented.title, null);
    assert.equal(presented.bio, null);
    assert.equal(presented.profilePath, null);
    assert.equal(JSON.stringify(presented).includes("TradeFlock Newsroom"), false);
    assert.equal(JSON.stringify(presented).includes("AI-assisted"), false);
    assert.deepEqual(articleAuthorMetadata({ slug: "tradeflock-newsroom", name: "TradeFlock Newsroom" }, canon), {
      name: "TradeFlock",
    });
  });
  it("omits the profile url when the byline has no author slug", () => {
    assert.deepEqual(authorStructuredData({ name: "Alex Rivera", title: "Reporter" }, canon), {
      "@type": "Person",
      name: "Alex Rivera",
      jobTitle: "Reporter",
    });
  });
  it("article pages do not hardcode a newsroom or AI-assisted byline", () => {
    for (const file of [
      "src/app/(public)/[slug]/page.tsx",
      "src/components/ArticleHeader.tsx",
      "src/components/ArticleAuthorCard.tsx",
      "src/components/RelatedArticles.tsx",
      "src/lib/seo.ts",
    ]) {
      const src = read(file);
      assert.doesNotMatch(src, /TradeFlock Newsroom/, file);
      assert.doesNotMatch(src, /AI-assisted/, file);
    }
    const seo = read("src/lib/seo.ts");
    assert.match(seo, /author: authorStructuredData\(article\.author, getCanonicalUrl\)/);
    assert.match(seo, /publisher: publisherRef\(\)/);
    assert.match(seo, /name: SITE_NAME/);
    assert.match(seo, /articleAuthorMetadata\(article\.author, getCanonicalUrl\)/);
    assert.match(read("src/components/ArticleHeader.tsx"), /articleBylinePresentation/);
    assert.match(read("src/components/ArticleAuthorCard.tsx"), /articleBylinePresentation/);
  });
  it("AI disclosure text stays available but is not rendered on article pages (paused by Vishal)", () => {
    const text = aiDisclosureText({ slug: "tradeflock-newsroom" });
    assert.match(text, /AI/);
    assert.match(text, /No human reviews it after that step/);
    assert.doesNotMatch(read("src/app/(public)/[slug]/page.tsx"), /data-ai-disclosure|aiDisclosureText/);
    assert.match(read("src/app/(public)/standards/page.tsx"), /no human reviews a news story after the Wire Editor approves it/);
  });
});

describe("external links (I)", () => {
  it("does not rewrite external URLs that look like desk paths", () => {
    assert.equal(toNewsArticleHref("https://www.reuters.com/markets/us-stocks-rally"), "https://www.reuters.com/markets/us-stocks-rally");
    assert.equal(toNewsArticleHref("https://www.cnbc.com/tech/some-story"), "https://www.cnbc.com/tech/some-story");
    assert.equal(rewriteInternalArticleHrefs('<a href="https://sec.gov/finance/x">x</a>'), '<a href="https://sec.gov/finance/x">x</a>');
  });
  it("still rewrites same-site desk links", () => {
    assert.equal(toNewsArticleHref("https://www.tradeflock.net/markets/fed-holds"), "/fed-holds");
    assert.equal(toNewsArticleHref("/tech/chip-story"), "/chip-story");
    assert.equal(toNewsArticleHref("https://tradeflock.net/news/abc"), "/abc");
  });
});

describe("no force-publish path (E)", () => {
  it("no source file references force publishing", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const ent of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${ent.name}`;
        if (ent.isDirectory()) walk(rel);
        else if (/\.(ts|tsx)$/.test(ent.name) && !rel.endsWith("newsroom.test.ts")) {
          const src = read(rel);
          if (/publishHighestScoringHold|shouldForcePublish|applyForcePublish|FORCE_PUBLISH_SCORE_MIN|searchParams\.get\("force"\)/.test(src)) hits.push(rel);
        }
      }
    };
    walk("src");
    assert.deepEqual(hits, []);
  });
  it("the scheduled publish workflow is gone; Signal Desk asserts published:0", () => {
    assert.doesNotMatch(read(".github/workflows/publish-news.yml"), /schedule:/);
    const sig = read(".github/workflows/signal-desk.yml");
    assert.match(sig, /api\/cron\/signals/);
    assert.match(sig, /"published":0/);
  });
  it("the wire pipeline has no direct publish insert", () => {
    const src = read("src/lib/agents/pipeline.ts");
    assert.doesNotMatch(src, /status: "published"/);
  });
  it("desk drafts use the original persona authors", () => {
    const src = read("src/lib/agents/pipeline.ts");
    assert.match(src, /tech:\s*"james-whitaker"/);
    assert.match(src, /markets:\s*"elena-vasquez"/);
    assert.match(src, /ma:\s*"sophia-brennan"/);
    assert.match(src, /strategy:\s*"marcus-chen"/);
    assert.match(src, /macro:\s*"elena-vasquez"/);
    assert.match(src, /retail:\s*"priya-nair"/);
    assert.doesNotMatch(src, /tradeflock-newsroom/);
  });
});

describe("migrations (C, D, J)", () => {
  const gate = read("supabase/migrations/20261007_newsroom_phase1_gate.sql");
  const tables = read("supabase/migrations/20261007_newsroom_phase1_tables.sql");
  const personaBylines = read("supabase/migrations/20261008_allow_persona_bylines.sql");
  it("gate names every exemption and the cap", () => {
    for (const e of ["'magazine'", "'success_insights'", "'legacy'", "'studio_draft'"]) assert.ok(gate.includes(e), e);
    assert.match(gate, /daily_cap constant integer := 8/);
    assert.match(gate, /America\/New_York/);
  });
  it("the later gate allows persona bylines and keeps the cap", () => {
    assert.match(personaBylines, /Persona bylines allowed/);
    assert.doesNotMatch(personaBylines, /uses a persona byline/);
    assert.match(personaBylines, /daily_cap constant integer := 8/);
    assert.match(personaBylines, /America\/New_York/);
  });
  it("verdict table enforces the PUBLISH bar and HF9 -> REVISE", () => {
    assert.match(tables, /editorial_verdicts_publish_bar/);
    assert.match(tables, /editorial_verdicts_hf9_revise/);
    assert.match(tables, /story_claims_one_open_owner/);
  });
});
