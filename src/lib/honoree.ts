import { usableHttpUrl } from "@/lib/magazine-links";
import type { ArticleWithRelations } from "@/lib/types";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function honoreeName(title: string, magazineTitle?: string) {
  const original = title.trim();
  const edition = magazineTitle?.trim();
  let name = original;
  if (edition) {
    name = name.replace(new RegExp(`[\\s\\-–—:]+${escapeRegExp(edition)}\\s*$`, "i"), "");
    name = name.replace(new RegExp(`${escapeRegExp(edition)}\\s*$`, "i"), "");
  }
  name = name.replace(/[\s\-–—:]+$/g, "").trim();
  return name || original;
}

function normalizeCopy(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function isRoleLine(value: string, excerpt: string) {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return false;
  const haystack = normalizeCopy(excerpt);
  const needle = normalizeCopy(text);
  if (haystack && (haystack === needle || haystack.startsWith(needle) || needle.startsWith(haystack.slice(0, 48)))) {
    return false;
  }
  if (/[.?!]/.test(text)) return false;
  if (text.split(/\s+/).length > 16) return false;
  return true;
}

export function honoreeRole(article: ArticleWithRelations) {
  const excerpt = article.excerpt.trim();
  const candidates = [article.designation, article.subheading, article.dek];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && isRoleLine(candidate, excerpt)) {
      return candidate.replace(/\s+/g, " ").trim();
    }
  }
  return "";
}

export function honoreeCompany(article: ArticleWithRelations) {
  if (article.company?.trim()) return article.company.trim();
  const role = honoreeRole(article);
  const excerpt = article.excerpt.trim();
  const extra = [article.subheading, article.designation];
  for (const candidate of extra) {
    if (typeof candidate !== "string") continue;
    const text = candidate.replace(/\s+/g, " ").trim();
    if (!text || text === role) continue;
    if (isRoleLine(text, excerpt)) return text;
  }
  return "";
}

export function honoreeBio(article: ArticleWithRelations) {
  const text = (article.bio || article.excerpt || article.dek || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length > 8 && letters === letters.toUpperCase()) {
    return text.charAt(0) + text.slice(1).toLowerCase();
  }
  return text;
}

export function honoreeLinkedInUrl(article: ArticleWithRelations) {
  return usableHttpUrl(article.linkedin_url);
}

export function honoreeWebsiteUrl(article: ArticleWithRelations) {
  return usableHttpUrl(article.website_url);
}

export function linkedInSearchUrl(name: string, company?: string | null) {
  return `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(`${name} ${company ?? ""}`.trim())}`;
}

export function honoreeLinkedInHref(options: {
  name: string;
  company?: string | null;
  linkedinUrl?: string | null;
}) {
  return (
    options.linkedinUrl?.trim() ||
    `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(`${options.name} ${options.company ?? ""}`)}`
  );
}
