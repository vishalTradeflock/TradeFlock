import { HEALTHCARE_2026_HONOREES, HEALTHCARE_EDITION_SLUG, SEED_ISSUE_HONOREES } from "@/lib/data/seed-honorees";
import {
  honoreeBio,
  honoreeCompany,
  honoreeName,
  honoreeRole,
} from "@/lib/honoree";
import type { ArticleWithRelations, Magazine, MagazineHonoree } from "@/lib/types";

function asText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function asPage(value: unknown) {
  const page = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(page) && page > 0 ? page : null;
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(dr|md|phd|do|fapa)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function parseMagazineHonorees(raw: unknown): MagazineHonoree[] {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];

  const honorees: MagazineHonoree[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const name = asText(row.name ?? row.title);
    if (!name) continue;
    honorees.push({
      name,
      designation: asText(row.designation ?? row.title_line ?? row.role) || null,
      company: asText(row.company ?? row.organization) || null,
      bio: asText(row.bio ?? row.excerpt ?? row.overview) || null,
      photo_url: asText(row.photo_url ?? row.photo ?? row.image ?? row.cover_image_url) || null,
      linkedin_url: asText(row.linkedin_url ?? row.linkedin) || null,
      website_url: asText(row.website_url ?? row.website) || null,
      page: asPage(row.page ?? row.magazine_page),
      magazine_page: asPage(row.magazine_page ?? row.page),
      slug: asText(row.slug) || null,
    });
  }
  return honorees;
}

export function articleToHonoree(
  article: ArticleWithRelations,
  magazineTitle?: string,
): MagazineHonoree {
  return {
    name: honoreeName(article.title, magazineTitle),
    designation: honoreeRole(article) || null,
    company: honoreeCompany(article) || null,
    bio: honoreeBio(article) || null,
    photo_url: article.cover_image_url?.trim() || null,
    linkedin_url: article.linkedin_url ?? null,
    website_url: article.website_url ?? null,
    page: article.magazine_page ?? null,
    magazine_page: article.magazine_page ?? null,
    slug: article.slug,
  };
}

function mergeProfile(base: MagazineHonoree, extra?: MagazineHonoree): MagazineHonoree {
  if (!extra) return base;
  return {
    name: base.name || extra.name,
    designation: base.designation || extra.designation,
    company: base.company || extra.company,
    bio: base.bio || extra.bio,
    photo_url: base.photo_url || extra.photo_url,
    linkedin_url: base.linkedin_url || extra.linkedin_url,
    website_url: base.website_url || extra.website_url,
    page: base.page ?? extra.page,
    magazine_page: base.magazine_page ?? extra.magazine_page ?? base.page ?? extra.page,
    slug: base.slug || extra.slug,
  };
}

export function expectedHonoreeCount(magazine: Pick<Magazine, "title" | "honorees">) {
  if (magazine.honorees?.length) return Math.max(magazine.honorees.length, 10);
  const match = magazine.title.match(/\b(\d+)\b/);
  if (match) {
    const count = Number.parseInt(match[1], 10);
    if (count >= 4 && count <= 50) return count;
  }
  return 10;
}

export function resolveIssueHonorees(
  magazine: Magazine,
  articles: ArticleWithRelations[],
): MagazineHonoree[] {
  const fromMagazine =
    magazine.slug === HEALTHCARE_EDITION_SLUG && articles.length < 10
      ? HEALTHCARE_2026_HONOREES
      : magazine.honorees?.length
        ? magazine.honorees
        : (SEED_ISSUE_HONOREES[magazine.slug] ?? []);
  const fromArticles = articles.map((article) => articleToHonoree(article, magazine.title));
  const expected = expectedHonoreeCount({
    title: magazine.title,
    honorees: fromMagazine,
  });

  if (fromArticles.length >= expected && fromMagazine.length === 0) {
    return fromArticles.map((honoree, index) => {
      const page = honoree.magazine_page ?? honoree.page ?? index * 2 + 4;
      return { ...honoree, page, magazine_page: page };
    });
  }

  const used = new Set<number>();
  const merged = fromMagazine.map((honoree, index) => {
    const key = normalizeName(honoree.name);
    const matchIndex = fromArticles.findIndex(
      (article, articleIndex) => !used.has(articleIndex) && normalizeName(article.name) === key,
    );
    const match = matchIndex >= 0 ? fromArticles[matchIndex] : undefined;
    if (matchIndex >= 0) used.add(matchIndex);
    const profile = mergeProfile(honoree, match);
    const page = profile.magazine_page ?? profile.page ?? index * 2 + 4;
    return {
      ...profile,
      page,
      magazine_page: page,
    };
  });

  if (merged.length >= expected) return merged.slice(0, Math.max(expected, merged.length));

  for (const [index, article] of fromArticles.entries()) {
    if (used.has(index)) continue;
    const page = article.magazine_page ?? article.page ?? merged.length * 2 + 4;
    merged.push({
      ...article,
      page,
      magazine_page: page,
    });
  }

  return merged;
}
