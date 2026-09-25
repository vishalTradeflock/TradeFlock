/**
 * Backfill: give every story that shares a cover (or carries a legacy stock
 * photo) a fresh, unused image. The oldest story in a duplicate group keeps
 * its cover. Shared by scripts/dedupe-covers.ts and /api/cron/dedupe-covers.
 * Relative `.ts` imports so it runs under `node --experimental-strip-types`.
 */
import {
  buildCoverSearchQueries,
  coverPhotoKey,
  planCoverReassignments,
  type CoverReassignment,
  type CoverRow,
} from "./cover-dedupe.ts";
import { pickUniqueCover, UnsplashRateLimitError } from "./cover-picker.ts";

const PAGE_SIZE = 1000;

export type BackfillRow = CoverRow & {
  status?: string | null;
  featured_image?: string | null;
};

type Page = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
type ArticlesTable = {
  select: (columns: string) => {
    order: (column: string, options: { ascending: boolean }) => {
      range: (from: number, to: number) => Page;
    };
  };
  update: (values: Record<string, unknown>) => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => {
        select: (columns: string) => Page;
      };
    };
  };
};
export type BackfillClient = { from: (table: "articles") => unknown };

function articles(client: BackfillClient) {
  return client.from("articles") as ArticlesTable;
}

/** Every article (all statuses the key can read), oldest first. */
export async function loadBackfillRows(client: BackfillClient): Promise<BackfillRow[]> {
  const rows: BackfillRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await articles(client)
      .select("id, title, slug, status, cover_image_url, featured_image, published_at, created_at, category:categories(slug)")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not load articles: ${error.message}`);
    const page = (data ?? []) as (BackfillRow & { category?: unknown })[];
    for (const row of page) {
      const category = Array.isArray(row.category) ? row.category[0] : row.category;
      rows.push({ ...row, category: (category as { slug?: string | null } | null) ?? null });
    }
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

export type BackfillChange = {
  id: string;
  slug: string | null | undefined;
  title: string;
  published_at: string | null | undefined;
  reason: CoverReassignment["reason"];
  shareCount: number;
  keeperTitle: string | null;
  oldCover: string | null;
  oldKey: string;
  newCover: string | null; // null = not picked (dry run without Unsplash key)
  newSource: "unsplash" | "neutral-card" | null;
  query?: string;
  queries: string[];
  applied: boolean;
  error?: string;
};

export type BackfillReport = {
  mode: "dry-run" | "apply";
  scanned: number;
  published: number;
  distinctPublishedCovers: number;
  duplicateGroups: number;
  legacyStockRows: number;
  toChange: number;
  processed: number;
  applied: number;
  stoppedReason?: string;
  topGroups: { key: string; count: number; legacy: boolean; examples: string[] }[];
  changes: BackfillChange[];
};

export async function runCoverBackfill(
  client: BackfillClient,
  options: {
    apply: boolean;
    limit?: number;
    unsplashAccessKey?: string | null;
    /** Published rows only are deduped; every row still counts as "used". */
    rows?: BackfillRow[];
    log?: (line: string) => void;
  },
): Promise<BackfillReport> {
  const log = options.log ?? (() => {});
  const rows = options.rows ?? (await loadBackfillRows(client));
  const published = rows.filter((row) => (row.status ?? "published") === "published");
  const plan = planCoverReassignments(published);

  const groups = new Map<string, BackfillRow[]>();
  for (const row of published) {
    const key = coverPhotoKey(row.cover_image_url);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const legacyKeys = new Set(plan.filter((item) => item.reason === "legacy_stock").map((item) => item.key));
  const topGroups = [...groups]
    .filter(([key, group]) => group.length > 1 || legacyKeys.has(key))
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 25)
    .map(([key, group]) => ({
      key,
      count: group.length,
      legacy: legacyKeys.has(key),
      examples: group.slice(-3).map((row) => row.title),
    }));

  const used = new Set<string>();
  for (const row of rows) {
    for (const url of [row.cover_image_url, row.featured_image]) {
      const key = coverPhotoKey(url);
      if (key) used.add(key);
    }
  }

  const report: BackfillReport = {
    mode: options.apply ? "apply" : "dry-run",
    scanned: rows.length,
    published: published.length,
    distinctPublishedCovers: groups.size,
    duplicateGroups: [...groups.values()].filter((group) => group.length > 1).length,
    legacyStockRows: plan.filter((item) => item.reason === "legacy_stock").length,
    toChange: plan.length,
    processed: 0,
    applied: 0,
    topGroups,
    changes: [],
  };

  const limit = Math.max(0, options.limit ?? plan.length);
  const accessKey = options.unsplashAccessKey?.trim() || null;
  if (options.apply && !accessKey) {
    throw new Error("UNSPLASH_ACCESS_KEY is required with --apply (otherwise every row would get the neutral card).");
  }

  for (const item of plan.slice(0, limit)) {
    const row = item.row as BackfillRow;
    const queries = buildCoverSearchQueries(row.title, row.category?.slug);
    const change: BackfillChange = {
      id: row.id,
      slug: row.slug,
      title: row.title,
      published_at: row.published_at,
      reason: item.reason,
      shareCount: item.shareCount,
      keeperTitle: item.keeper?.title ?? null,
      oldCover: row.cover_image_url,
      oldKey: item.key,
      newCover: null,
      newSource: null,
      queries,
      applied: false,
    };

    if (accessKey) {
      try {
        const picked = await pickUniqueCover({
          title: row.title,
          categorySlug: row.category?.slug,
          used,
          accessKey,
          queries,
          trackDownload: options.apply,
        });
        change.newCover = picked?.url ?? "";
        change.newSource = picked ? "unsplash" : "neutral-card";
        change.query = picked?.query;
      } catch (err) {
        if (err instanceof UnsplashRateLimitError) {
          report.stoppedReason = "Unsplash rate limit reached — rerun later; finished rows are skipped automatically.";
          break;
        }
        change.error = err instanceof Error ? err.message : String(err);
      }
    }

    if (options.apply && change.newCover !== null && !change.error) {
      const values: Record<string, unknown> = { cover_image_url: change.newCover };
      if (coverPhotoKey(row.featured_image) === item.key) values.featured_image = change.newCover || null;
      // Optimistic guard: only if the row still has the cover we planned against.
      const { data, error } = await articles(client)
        .update(values)
        .eq("id", row.id)
        .eq("cover_image_url", row.cover_image_url ?? "")
        .select("id");
      if (error) change.error = error.message;
      else if (!data?.length) change.error = "skipped: cover changed since scan";
      else {
        change.applied = true;
        report.applied += 1;
      }
    }

    report.processed += 1;
    report.changes.push(change);
    log(
      `${change.applied ? "UPDATED" : options.apply ? "SKIPPED" : "WOULD CHANGE"} ${row.slug ?? row.id} ` +
        `[${item.reason}${item.keeper ? `, keeper: ${item.keeper.title}` : ""}] ` +
        `${item.key} -> ${change.newCover === null ? `(queries: ${queries.slice(0, 3).join(" | ")})` : change.newCover || "neutral card"}` +
        (change.error ? ` ERROR ${change.error}` : ""),
    );
  }

  return report;
}
