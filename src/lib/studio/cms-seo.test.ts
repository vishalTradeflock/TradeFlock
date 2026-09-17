import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { articlePath } from "../types.ts";
import { PRODUCTION_ORIGIN } from "../site-url.ts";
import {
  exactRequestedArticleSlug,
  resolvePublishedArticleRequest,
} from "../article-slug-request.ts";
import {
  firstPartyMediaUrl,
  isBlockedHostname,
  isBlockedIp,
  parseExternalImageUrl,
} from "../media-proxy.ts";
import { prepareGlobalHeadCode, roleCanWriteGlobalHeadCode, shouldInjectGlobalHead } from "../public-head.ts";
import { sitemapImageUrl, sitemapNewsPath } from "../sitemap-urls.ts";
import { faqAnswerPlainText, prepareStudioFaqs, sanitizeFaqAnswer } from "./faqs.ts";
import { sanitizeAltText, sanitizeBio, sanitizeVerificationToken } from "./head-meta.ts";
import { auditPublishedSlugs, buildSlugCleanupReport, classifySlugProblem } from "./slug-audit.ts";
import {
  allocateArticleSlug,
  isValidPublicSlug,
  proposeCleanSlug,
  sanitizeSlug,
  slugFromTitle,
} from "./slug.ts";

describe("sanitizeSlug", () => {
  it("builds a URL-safe slug from a headline", () => {
    assert.equal(sanitizeSlug("Apple Announces New AI Strategy"), "apple-announces-new-ai-strategy");
    assert.equal(isValidPublicSlug("apple-announces-new-ai-strategy"), true);
  });

  it("does not append a timestamp or content key", () => {
    const slug = slugFromTitle("Desk Note");
    assert.equal(slug, "desk-note");
    assert.equal(/\d/.test(slug), false);
  });

  it("rejects empty, unsafe, and trailing-hyphen values", () => {
    assert.equal(sanitizeSlug("@@@"), "");
    assert.equal(isValidPublicSlug(""), false);
    assert.equal(isValidPublicSlug("Hello World"), false);
    assert.equal(isValidPublicSlug("article-title-"), false);
    assert.equal(sanitizeSlug("article-title-"), "article-title");
  });

  it("strips database/content keys from generated slugs", () => {
    assert.equal(
      sanitizeSlug("salesforce-ceo-warns-of-ai-risks-mu39m09z"),
      "salesforce-ceo-warns-of-ai-risks",
    );
    assert.equal(slugFromTitle("Salesforce CEO warns of AI risks-mu39m09z"), "salesforce-ceo-warns-of-ai-risks");
    assert.equal(
      sanitizeSlug("oracle-s-ai-cloud-wins-force-a-rethink-of-who-counts-as--8mrr16"),
      "oracle-s-ai-cloud-wins-force-a-rethink-of-who-counts-as",
    );
    assert.equal(
      sanitizeSlug("networking-silicon-not-gpus-is-the-hidden-bill-in-every--ipcqqu"),
      "networking-silicon-not-gpus-is-the-hidden-bill-in-every",
    );
  });

  it("matches the public slug validation pattern", () => {
    const pattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
    assert.equal(pattern.test("salesforce-ceo-warns-of-ai-risks"), true);
    assert.equal(pattern.test("salesforce-ceo-warns-of-ai-risks-"), false);
    assert.equal(isValidPublicSlug("a"), true);
  });

  it("does not put category names in article URLs", () => {
    const slug = sanitizeSlug("Salesforce CEO warns of AI risks");
    assert.equal(articlePath(slug), "/news/salesforce-ceo-warns-of-ai-risks");
    assert.equal(articlePath(slug).includes("/technology/"), false);
    assert.equal(articlePath(slug).includes("/tech/"), false);
    assert.equal(sanitizeSlug("technology/salesforce-ceo-warns-of-ai-risks"), "salesforce-ceo-warns-of-ai-risks");
  });

  it("keeps years and uniqueness suffixes", () => {
    assert.equal(sanitizeSlug("40-under-40-usa-2025"), "40-under-40-usa-2025");
    assert.equal(sanitizeSlug("desk-note-2"), "desk-note-2");
  });

  it("allocates unique slugs without content keys", async () => {
    const taken = new Set(["desk-note"]);
    const slug = await allocateArticleSlug(null, "Desk Note", async (value) => taken.has(value));
    assert.equal(slug, "desk-note-2");
    assert.equal(isValidPublicSlug(slug), true);
  });
});

describe("slug audit", () => {
  it("proposes cleaned URLs without rewriting", () => {
    const rows = auditPublishedSlugs([
      { id: "keep", slug: "apple-announces-new-ai-strategy" },
      { id: "key", slug: "salesforce-ceo-warns-of-ai-risks-mu39m09z" },
      { id: "hyphen", slug: "salesforce-ceo-warns-of-ai-risks-" },
    ]);
    assert.equal(rows.some((row) => row.articleId === "keep"), false);
    const keyed = rows.find((row) => row.articleId === "key");
    assert.equal(keyed?.proposedSlug, "salesforce-ceo-warns-of-ai-risks");
    assert.equal(keyed?.currentPublicUrl, `${PRODUCTION_ORIGIN}/news/salesforce-ceo-warns-of-ai-risks-mu39m09z`);
    assert.equal(keyed?.proposedPublicUrl, `${PRODUCTION_ORIGIN}/news/salesforce-ceo-warns-of-ai-risks`);
    assert.equal(proposeCleanSlug("salesforce-ceo-warns-of-ai-risks-"), "salesforce-ceo-warns-of-ai-risks");
  });

  it("classifies problem types and marks collisions instead of inventing a slug", () => {
    assert.equal(classifySlugProblem("salesforce-ceo-warns-of-ai-risks-mu39m09z"), "content_key_suffix");
    assert.equal(classifySlugProblem("oracle-counts-as--8mrr16"), "double_hyphen_key");
    assert.equal(classifySlugProblem("fortune-50-"), "trailing_hyphen");

    const report = buildSlugCleanupReport([
      { id: "clean", slug: "apple-announces-new-ai-strategy" },
      { id: "taken", slug: "salesforce-ceo-warns-of-ai-risks" },
      { id: "key", slug: "salesforce-ceo-warns-of-ai-risks-mu39m09z" },
      { id: "a", slug: "same-headline-abc123xy" },
      { id: "b", slug: "same-headline-def456zz" },
    ]);
    const keyed = report.find((row) => row.articleId === "key");
    assert.equal(keyed?.collisionStatus, "COLLISION");
    assert.equal(keyed?.redirectRequired, true);
    const a = report.find((row) => row.articleId === "a");
    const b = report.find((row) => row.articleId === "b");
    assert.equal(a?.proposedSlug, "same-headline");
    assert.equal(b?.proposedSlug, "same-headline");
    assert.equal(a?.collisionStatus, "COLLISION");
    assert.equal(b?.collisionStatus, "COLLISION");
    assert.equal(report.some((row) => row.articleId === "clean"), false);
  });
});

describe("published slug redirect lookup order", () => {
  const trailingOld = "american-airlines-new-coo-inherits-a-pilot-training-bottleneck-into-the-";
  const trailingNew = "american-airlines-new-coo-inherits-a-pilot-training-bottleneck-into-the";
  const contentKeyOld = "amazon-microsoft-and-google-lock-multi-year-gpu-campuses-cg5faq";
  const contentKeyNew = "amazon-microsoft-and-google-lock-multi-year-gpu-campuses";
  const doubleHyphenOld = "networking-silicon-not-gpus-is-the-hidden-bill-in-every--ipcqqu";
  const doubleHyphenNew = "networking-silicon-not-gpus-is-the-hidden-bill-in-every";

  it("old trailing-hyphen slug → 308 even if hyphen fallback would find the article", () => {
    assert.equal(exactRequestedArticleSlug(trailingOld), trailingOld);
    const result = resolvePublishedArticleRequest({
      requestedSlug: trailingOld,
      redirectToSlug: trailingNew,
      articleFound: true,
    });
    assert.equal(result.status, 308);
    assert.equal(result.kind, "redirect");
  });

  it("Location header points to the clean current URL", () => {
    const result = resolvePublishedArticleRequest({
      requestedSlug: trailingOld,
      redirectToSlug: trailingNew,
      articleFound: true,
    });
    assert.equal(result.kind, "redirect");
    if (result.kind !== "redirect") return;
    assert.equal(result.location, `/news/${trailingNew}`);
    assert.equal(result.location.endsWith("-"), false);
    assert.equal(result.location.includes(trailingOld), false);
  });

  it("clean slug → 200", () => {
    const result = resolvePublishedArticleRequest({
      requestedSlug: trailingNew,
      redirectToSlug: null,
      articleFound: true,
    });
    assert.equal(result.status, 200);
    assert.equal(result.kind, "render");
  });

  it("old content-key slug → existing 308 behavior", () => {
    assert.equal(exactRequestedArticleSlug(contentKeyOld), contentKeyOld);
    const result = resolvePublishedArticleRequest({
      requestedSlug: contentKeyOld,
      redirectToSlug: contentKeyNew,
      articleFound: false,
    });
    assert.equal(result.status, 308);
    assert.equal(result.kind, "redirect");
    if (result.kind !== "redirect") return;
    assert.equal(result.location, `/news/${contentKeyNew}`);
  });

  it("old double-hyphen slug → existing 308 behavior", () => {
    assert.equal(exactRequestedArticleSlug(doubleHyphenOld), doubleHyphenOld);
    const result = resolvePublishedArticleRequest({
      requestedSlug: doubleHyphenOld,
      redirectToSlug: doubleHyphenNew,
      articleFound: false,
    });
    assert.equal(result.status, 308);
    assert.equal(result.kind, "redirect");
    if (result.kind !== "redirect") return;
    assert.equal(result.location, `/news/${doubleHyphenNew}`);
  });

  it("public pages are indexable and studio stays noindex", () => {
    const layout = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(layout, /SITE_ROBOTS/);
    assert.doesNotMatch(layout, /index:\s*false/);
    assert.doesNotMatch(layout, /noindex/);
    assert.doesNotMatch(layout, /robots:/);
    const studio = readFileSync(new URL("../../app/studio/layout.tsx", import.meta.url), "utf8");
    assert.match(studio, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
    const robots = readFileSync(new URL("../../app/robots.ts", import.meta.url), "utf8");
    assert.match(robots, /allow:\s*"\/"/);
    assert.match(robots, /disallow:\s*\["\/studio\/",\s*"\/api\/"\]/);
    assert.match(robots, /sitemap\.xml/);
    assert.match(robots, /tradeflock\.net\/sitemap\.xml|`\$\{origin\}\/sitemap\.xml`/);
  });

  it("article page checks exact redirects before getArticleBySlug", () => {
    const page = readFileSync(new URL("../../app/news/[slug]/page.tsx", import.meta.url), "utf8");
    const helperStart = page.indexOf("async function loadPublishedArticleOrRedirect");
    const helperEnd = page.indexOf("export async function generateMetadata");
    const helper = page.slice(helperStart, helperEnd);
    assert.ok(helperStart >= 0);
    const redirectIdx = helper.indexOf("resolvePublishedSlugRedirect");
    const articleIdx = helper.lastIndexOf("getArticleBySlug");
    assert.ok(redirectIdx >= 0);
    assert.ok(articleIdx >= 0);
    assert.ok(redirectIdx < articleIdx);
    assert.match(helper, /resolvePublishedArticleRequest/);
    assert.doesNotMatch(page, /getArticleBySlug\(cleanSlug\);\s*if \(!article\) \{\s*const redirected = await resolvePublishedSlugRedirect/);

    const articles = readFileSync(new URL("../articles.ts", import.meta.url), "utf8");
    assert.match(articles, /exactRequestedArticleSlug/);
    const fallbackComment = articles.indexOf("Used only after exact redirect lookup");
    const fallbackFn = articles.indexOf("function slugFallbacks");
    assert.ok(fallbackComment >= 0 && fallbackComment < fallbackFn);
  });
});

describe("sitemap article URLs", () => {
  it("only emits /news/{slug} and drops trailing hyphens", () => {
    assert.equal(sitemapNewsPath("salesforce-ceo-warns-of-ai-risks"), "/news/salesforce-ceo-warns-of-ai-risks");
    assert.equal(sitemapNewsPath("salesforce-ceo-warns-of-ai-risks-"), null);
    assert.equal(sitemapNewsPath("Hello World"), null);
    const path = sitemapNewsPath("apple-announces-new-ai-strategy");
    assert.equal(path?.startsWith("/news/"), true);
    assert.equal(path?.includes("/technology/"), false);
    assert.equal(path?.includes("/markets/"), false);
  });

  it("uses first-party URLs for sitemap images", () => {
    const proxied = sitemapImageUrl("https://image.cnbcfm.com/api/v1/image/cover.jpg");
    assert.match(proxied ?? "", /^https:\/\/www\.tradeflock\.net\/media\/proxy\?src=/);
    assert.equal(sitemapImageUrl("/covers/issue.jpg"), `${PRODUCTION_ORIGIN}/covers/issue.jpg`);
  });
});

describe("image proxy helpers", () => {
  it("rejects localhost, private IPs, and non-http sources", () => {
    assert.equal(parseExternalImageUrl("http://127.0.0.1/x.jpg"), null);
    assert.equal(parseExternalImageUrl("http://localhost/x.jpg"), null);
    assert.equal(parseExternalImageUrl("http://192.168.1.4/x.jpg"), null);
    assert.equal(parseExternalImageUrl("http://10.0.0.8/x.jpg"), null);
    assert.equal(parseExternalImageUrl("file:///etc/passwd"), null);
    assert.equal(isBlockedHostname("localhost"), true);
    assert.equal(isBlockedIp("169.254.169.254"), true);
    assert.ok(parseExternalImageUrl("https://image.cnbcfm.com/cover.jpg"));
  });

  it("converts third-party sources to first-party proxy URLs", () => {
    const url = firstPartyMediaUrl("https://images.unsplash.com/photo-1");
    assert.match(url ?? "", /^https:\/\/www\.tradeflock\.net\/media\/proxy\?src=/);
    assert.equal(
      firstPartyMediaUrl("https://www.tradeflock.net/og/default"),
      "https://www.tradeflock.net/og/default",
    );
  });
});

describe("global head code", () => {
  it("persists script, meta, link, and JSON-LD markup", () => {
    const html = `<meta name="foo" content="bar" />
<link rel="preconnect" href="https://example.com" />
<script type="application/ld+json">{"@type":"WebSite"}</script>
<script src="https://example.com/pixel.js"></script>`;
    const prepared = prepareGlobalHeadCode(html);
    assert.equal(prepared.ok, true);
    if (!prepared.ok) return;
    assert.equal(prepared.value, html);
    assert.match(prepared.value ?? "", /<script/);
    assert.match(prepared.value ?? "", /application\/ld\+json/);
  });

  it("renders only on public pages", () => {
    assert.equal(shouldInjectGlobalHead("/"), true);
    assert.equal(shouldInjectGlobalHead("/news/a-story"), true);
    assert.equal(shouldInjectGlobalHead("/studio"), false);
    assert.equal(shouldInjectGlobalHead("/studio/settings"), false);
    assert.equal(shouldInjectGlobalHead("/api/studio/write"), false);
  });

  it("is admin/masthead-only to write", () => {
    assert.equal(roleCanWriteGlobalHeadCode(null), false);
    assert.equal(roleCanWriteGlobalHeadCode("writer"), false);
    assert.equal(roleCanWriteGlobalHeadCode("moderator"), true);
    assert.equal(roleCanWriteGlobalHeadCode("editor"), true);
    assert.equal(roleCanWriteGlobalHeadCode("admin"), true);
  });

  it("documents RLS so anon cannot select executable columns", () => {
    const sql = readFileSync(new URL("../../../supabase/migrations/20260917_global_head_code.sql", import.meta.url), "utf8");
    assert.match(sql, /grant select \(id, google_site_verification, bing_site_verification, updated_at\)/i);
    assert.match(sql, /revoke all on table public\.site_settings from anon, authenticated/i);
    assert.doesNotMatch(sql, /grant insert on table public\.site_settings to anon/i);
    assert.match(sql, /global_head_code/);
    assert.match(sql, /header_scripts/);
  });

  it("is wired into the root layout with indexable public robots", () => {
    const layout = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(layout, /SITE_ROBOTS/);
    assert.doesNotMatch(layout, /TEMPORARY: site-wide noindex/);
    assert.doesNotMatch(layout, /robots:/);
    assert.match(layout, /GlobalHeadCode/);
    assert.match(layout, /shouldInjectGlobalHead/);
    const seo = readFileSync(new URL("../seo.ts", import.meta.url), "utf8");
    assert.match(seo, /DEFAULT_OG_IMAGE_PATH = "\/og\/default"/);
    assert.match(seo, /PUBLISHER_LOGO_PATH = "\/brand\/logo"/);
    assert.doesNotMatch(seo, /unsplash/i);
    assert.doesNotMatch(seo, /tradeflockusa\.com\/wp-content/);
  });
});

describe("prepareStudioFaqs", () => {
  it("drops empty rows and sanitizes answers", () => {
    const result = prepareStudioFaqs([
      { question: "", answer: "" },
      {
        question: "What changed?",
        answer: '<p>The board voted</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>',
      },
    ]);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.faqs.length, 1);
    assert.equal(result.faqs[0].question, "What changed?");
    assert.equal(result.faqs[0].answer.includes("script"), false);
    assert.equal(result.faqs[0].answer.includes("javascript"), false);
  });

  it("skips incomplete pairs rather than storing them", () => {
    const result = prepareStudioFaqs([{ question: "Only a question?", answer: "  " }]);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.faqs, []);
  });
});

describe("faqAnswerPlainText", () => {
  it("strips tags for JSON-LD", () => {
    assert.equal(faqAnswerPlainText("<p>The <strong>Fed</strong> held rates.</p>"), "The Fed held rates.");
  });
});

describe("sanitizeFaqAnswer", () => {
  it("keeps simple formatting", () => {
    const html = sanitizeFaqAnswer("<p>See <a href=\"https://www.tradeflock.net/news/x\">the story</a>.</p>");
    assert.match(html, /<a href="https:\/\/www.tradeflock.net\/news\/x">/);
  });
});

describe("head meta sanitizers", () => {
  it("accepts a Google token and a meta tag paste", () => {
    assert.equal(sanitizeVerificationToken("abcDEF123_-xyz"), "abcDEF123_-xyz");
    assert.equal(
      sanitizeVerificationToken('<meta name="google-site-verification" content="abcDEF123_-xyz" />'),
      "abcDEF123_-xyz",
    );
    assert.equal(sanitizeVerificationToken("<script>alert(1)</script>"), null);
  });

  it("does not invent alt text or bios", () => {
    assert.equal(sanitizeAltText("  "), "");
    assert.equal(sanitizeAltText("<b>Apple CEO speaking</b>").includes("<"), false);
    assert.equal(sanitizeBio("<p>Covers markets.</p>"), "Covers markets.");
  });
});
