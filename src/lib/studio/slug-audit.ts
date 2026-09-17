import { PRODUCTION_ORIGIN } from "../site-url.ts";
import { articlePath } from "../types.ts";
import { isValidPublicSlug, needsSlugCleanup, proposeCleanSlug } from "./slug.ts";

export type SlugAuditRow = {
  id: string;
  slug: string;
};

export type SlugAuditResult = {
  articleId: string;
  currentSlug: string;
  proposedSlug: string;
  currentPublicUrl: string;
  proposedPublicUrl: string;
};

export type SlugProblemType =
  | "content_key_suffix"
  | "double_hyphen_key"
  | "trailing_hyphen"
  | "other_invalid";

export type SlugCleanupReportRow = SlugAuditResult & {
  problemType: SlugProblemType;
  collisionStatus: "OK" | "COLLISION";
  redirectRequired: boolean;
};

function publicUrl(slug: string) {
  return `${PRODUCTION_ORIGIN}${articlePath(slug)}`;
}

export function classifySlugProblem(current: string): SlugProblemType {
  const trimmed = current.trim();
  if (trimmed.endsWith("-")) return "trailing_hyphen";
  if (trimmed.includes("--")) return "double_hyphen_key";
  if (needsSlugCleanup(trimmed)) return "content_key_suffix";
  return "other_invalid";
}

export function auditPublishedSlugs(rows: SlugAuditRow[]): SlugAuditResult[] {
  const results: SlugAuditResult[] = [];
  for (const row of rows) {
    const current = row.slug.trim();
    if (!needsSlugCleanup(current)) continue;
    const proposed = proposeCleanSlug(current);
    if (!proposed) continue;
    results.push({
      articleId: row.id,
      currentSlug: current,
      proposedSlug: proposed,
      currentPublicUrl: publicUrl(current),
      proposedPublicUrl: publicUrl(proposed),
    });
  }
  return results;
}

export function proposedSlugCollisions(results: SlugAuditResult[]) {
  const counts = new Map<string, string[]>();
  for (const row of results) {
    const list = counts.get(row.proposedSlug) ?? [];
    list.push(row.articleId);
    counts.set(row.proposedSlug, list);
  }
  return [...counts.entries()].filter(([, ids]) => ids.length > 1);
}

/**
 * Audit-only cleanup rows. Uses proposeCleanSlug — never allocates a unique
 * suffix. A proposed slug taken by another published article, or by another
 * proposed cleanup, is marked COLLISION.
 */
export function buildSlugCleanupReport(rows: SlugAuditRow[]): SlugCleanupReportRow[] {
  const publishedOwners = new Map<string, string[]>();
  for (const row of rows) {
    const slug = row.slug.trim();
    const list = publishedOwners.get(slug) ?? [];
    list.push(row.id);
    publishedOwners.set(slug, list);
  }

  const affected: SlugAuditResult[] = [];
  for (const row of rows) {
    const current = row.slug.trim();
    const proposed = proposeCleanSlug(current);
    if (proposed && proposed !== current) {
      affected.push({
        articleId: row.id,
        currentSlug: current,
        proposedSlug: proposed,
        currentPublicUrl: publicUrl(current),
        proposedPublicUrl: publicUrl(proposed),
      });
      continue;
    }
    if (!isValidPublicSlug(current)) {
      affected.push({
        articleId: row.id,
        currentSlug: current,
        proposedSlug: proposed,
        currentPublicUrl: publicUrl(current),
        proposedPublicUrl: proposed ? publicUrl(proposed) : "",
      });
    }
  }

  const proposedOwners = new Map<string, string[]>();
  for (const row of affected) {
    if (!row.proposedSlug) continue;
    const list = proposedOwners.get(row.proposedSlug) ?? [];
    list.push(row.articleId);
    proposedOwners.set(row.proposedSlug, list);
  }

  return affected.map((row) => {
    const proposedTakenByPublished = row.proposedSlug
      ? (publishedOwners.get(row.proposedSlug) ?? []).some((id) => id !== row.articleId)
      : false;
    const proposedTakenByPeer = row.proposedSlug
      ? (proposedOwners.get(row.proposedSlug) ?? []).length > 1
      : false;
    const collision = proposedTakenByPublished || proposedTakenByPeer;
    return {
      ...row,
      problemType: classifySlugProblem(row.currentSlug),
      collisionStatus: collision ? "COLLISION" : "OK",
      redirectRequired: Boolean(row.proposedSlug) && row.proposedSlug !== row.currentSlug,
    };
  });
}
