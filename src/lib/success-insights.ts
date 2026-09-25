/** Success Insights is a magazine/profile desk — never mix it into news rails. */

export const SUCCESS_INSIGHTS_SLUG = "success-insights";
export const SUCCESS_INSIGHTS_NAME = "Success Insights";

/** Editorial news desks. SI listicles miscategorized here should be moved back. */
export const EDITORIAL_DESK_SLUGS = [
  "tech",
  "technology",
  "markets",
  "leadership",
  "finance",
] as const;

/**
 * WordPress SI listicle series fragments (slug or kebab-cased title).
 * Example: norliana-aida-ramli-visionary-ceos-to-watch-in-2026
 */
export const SI_LISTICLE_NEEDLES = [
  "to-watch-in-20",
  "visionary-ceos",
  "empowering-women",
  "entrepreneurs-to-watch",
  "influential-leaders",
  "innovative-global-coos",
  "healthcare-executives",
  "leaders-to-watch",
  "ceos-to-watch",
  "coos-to-watch",
] as const;

/** Strip-tags length at or below this counts as a one-paragraph bio, not a story. */
export const SI_BLURB_MAX_CHARS = 1000;

/** Fewer than this many real paragraphs counts as a blurb even if the char count is higher. */
export const SI_BLURB_MIN_PARAGRAPHS = 3;

const REAL_PARAGRAPH_MIN_CHARS = 40;

export function kebabHaystack(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isSuccessInsightsCategory(category: {
  slug?: string | null;
  name?: string | null;
} | null | undefined) {
  if (!category) return false;
  const slug = String(category.slug ?? "").trim().toLowerCase();
  const name = String(category.name ?? "").trim().toLowerCase();
  return slug === SUCCESS_INSIGHTS_SLUG || name === SUCCESS_INSIGHTS_NAME.toLowerCase();
}

export function looksLikeSuccessInsightsListicle(
  title?: string | null,
  slug?: string | null,
) {
  const haystack = `${kebabHaystack(slug ?? "")} ${kebabHaystack(title ?? "")}`.trim();
  if (!haystack) return false;
  return SI_LISTICLE_NEEDLES.some((needle) => haystack.includes(needle));
}

export function isSuccessInsightsArticle(article: {
  category?: { slug?: string | null; name?: string | null } | null;
  title?: string | null;
  slug?: string | null;
}) {
  if (isSuccessInsightsCategory(article.category)) return true;
  return looksLikeSuccessInsightsListicle(article.title, article.slug);
}

export function withoutSuccessInsights<T extends {
  category?: { slug?: string | null; name?: string | null } | null;
  title?: string | null;
  slug?: string | null;
}>(articles: T[]) {
  return articles.filter((article) => !isSuccessInsightsArticle(article));
}

export function partitionHomeArticles<T extends {
  category: { slug: string; name: string };
  title?: string | null;
  slug?: string | null;
}>(articles: T[]) {
  const editorialArticles: T[] = [];
  const successInsightsArticles: T[] = [];
  for (const article of articles) {
    if (isSuccessInsightsArticle(article)) {
      successInsightsArticles.push(article);
    } else {
      editorialArticles.push(article);
    }
  }
  return { editorialArticles, successInsightsArticles };
}

/**
 * Breaking ticker: Success Insights stories only, deduped by id/slug, capped at `limit`.
 * Ticker only — rails and desks keep using `withoutSuccessInsights`.
 */
export function successInsightsTickerArticles<T extends {
  id: string;
  slug: string;
  category?: { slug?: string | null; name?: string | null } | null;
  title?: string | null;
}>(articles: T[], limit = 12) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const article of articles) {
    if (out.length >= limit) break;
    if (!isSuccessInsightsArticle(article)) continue;
    if (seen.has(article.id) || seen.has(`slug:${article.slug}`)) continue;
    seen.add(article.id);
    seen.add(`slug:${article.slug}`);
    out.push(article);
  }
  return out;
}

export function stripHtmlToText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function countRealParagraphs(html: string) {
  const blocks = html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) ?? [];
  const fromTags = blocks.filter(
    (block) => stripHtmlToText(block).length >= REAL_PARAGRAPH_MIN_CHARS,
  );
  if (fromTags.length) return fromTags.length;

  const fromBreaks = stripHtmlToText(html.replace(/<br\s*\/?>/gi, "\n"))
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length >= REAL_PARAGRAPH_MIN_CHARS);
  if (fromBreaks.length) return fromBreaks.length;

  const text = stripHtmlToText(html);
  return text.length >= REAL_PARAGRAPH_MIN_CHARS ? 1 : 0;
}

export function isShortProfileBlurb(body: string) {
  const text = stripHtmlToText(body);
  if (!text) return true;
  const paragraphs = countRealParagraphs(body);
  return text.length < SI_BLURB_MAX_CHARS || paragraphs < SI_BLURB_MIN_PARAGRAPHS;
}

export function shouldUnpublishSiBlurb(article: {
  category?: { slug?: string | null; name?: string | null } | null;
  title?: string | null;
  slug?: string | null;
  body?: string | null;
}) {
  if (!isSuccessInsightsArticle(article)) return false;
  return isShortProfileBlurb(article.body ?? "");
}

export function shouldRecategorizeToSuccessInsights(article: {
  category?: { slug?: string | null; name?: string | null } | null;
  title?: string | null;
  slug?: string | null;
}) {
  if (!looksLikeSuccessInsightsListicle(article.title, article.slug)) return false;
  if (isSuccessInsightsCategory(article.category)) return false;
  const slug = String(article.category?.slug ?? "").trim().toLowerCase();
  const name = String(article.category?.name ?? "").trim().toLowerCase();
  return (
    EDITORIAL_DESK_SLUGS.includes(slug as (typeof EDITORIAL_DESK_SLUGS)[number]) ||
    EDITORIAL_DESK_SLUGS.includes(name as (typeof EDITORIAL_DESK_SLUGS)[number])
  );
}
