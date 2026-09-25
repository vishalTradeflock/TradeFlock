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
  planNameQueryRedos,
  type CoverReassignment,
  type CoverRow,
  type CoverSearchContext,
} from "./cover-dedupe.ts";
import { pickUniqueCover, UnsplashRateLimitError } from "./cover-picker.ts";
import {
  chooseSourceImage,
  extractSourceArticleUrl,
  fetchSourceImageCandidates,
  shouldTrySourcePhoto,
  sourceCoverAlt,
  SOURCE_BACKFILL_BUDGET_MS,
} from "./source-photo.ts";

const PAGE_SIZE = 1000;

export type BackfillRow = CoverRow & {
  status?: string | null;
  featured_image?: string | null;
  body?: string | null;
  canonical_url?: string | null;
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
      .select(
        "id, title, slug, status, cover_image_url, featured_image, published_at, created_at, excerpt, company, body, canonical_url, category:categories(slug)",
      )
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
  newCover: string | null; // null = not picked (dry run without Unsplash key, or skipped)
  newSource: "unsplash" | "neutral-card" | "source_photo" | null;
  /** Topic alt for a source photo. Personal names are already stripped from queries. */
  alt?: string;
  sourceUrl?: string;
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
  /** Profiles whose cover is still a photo assigned by a person-name search. */
  nameQueryRedos: number;
  /** Rows whose new cover came from the source article rather than Unsplash. */
  sourcePhotos: number;
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
    /**
     * Re-pick the hardcoded person-name covers before duplicates.
     * Defaults to on when `apply` is set, so a write pass always clears them once.
     */
    redoNameQueries?: boolean;
    /** Defaults to NAME_QUERY_REDO_SLUGS. A slug is skipped once its cover is no longer one of those photos. */
    redoSlugs?: readonly string[];
    /** Published rows only are deduped; every row still counts as "used". */
    rows?: BackfillRow[];
    /** Stop starting new rows after this many milliseconds. Default 270s. */
    budgetMs?: number;
    now?: () => number;
    /** Page fetch for source photos. Tests inject this; production uses global fetch. */
    fetchPage?: typeof fetch;
    log?: (line: string) => void;
  },
): Promise<BackfillReport> {
  const log = options.log ?? (() => {});
  const rows = options.rows ?? (await loadBackfillRows(client));
  const published = rows.filter((row) => (row.status ?? "published") === "published");
  const redoNameQueries = options.redoNameQueries ?? options.apply;
  const redos = redoNameQueries ? planNameQueryRedos(rows, options.redoSlugs) : [];
  const redoIds = new Set(redos.map((item) => item.row.id));
  const plan = [
    ...redos,
    ...planCoverReassignments(published).filter((item) => !redoIds.has(item.row.id)),
  ];

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
    nameQueryRedos: redos.length,
    sourcePhotos: 0,
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

  const started = (options.now ?? Date.now)();
  const budgetMs = options.budgetMs ?? SOURCE_BACKFILL_BUDGET_MS;
  const clock = options.now ?? Date.now;
  let unsplashBlocked = false;
  let taken = 0;

  for (const item of plan) {
    if (clock() - started >= budgetMs) {
      report.stoppedReason ??=
        "Time budget reached — rerun later; finished rows are skipped automatically.";
      break;
    }
    if (taken >= limit) break;

    const row = item.row as BackfillRow;
    const context: CoverSearchContext = {
      slug: row.slug,
      personName: row.personName,
      company: row.company,
      excerpt: row.excerpt,
    };
    const queries = buildCoverSearchQueries(row.title, row.category?.slug, context);
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

    const page = sourcePageFor(row);
    if (page) {
      change.sourceUrl = page;
      try {
        const candidates = await fetchSourceImageCandidates(page, options.fetchPage);
        const chosen = chooseSourceImage(candidates, used);
        if (chosen?.ok) {
          used.add(chosen.key);
          change.newCover = chosen.url;
          change.newSource = "source_photo";
          change.reason = "source_photo";
          change.alt = sourceCoverAlt(queries);
          change.query = page;
          report.sourcePhotos += 1;
        }
      } catch {
        /* Source page failed; Unsplash is the fallback when it is still available. */
      }
    }

    if (change.newCover === null) {
      if (unsplashBlocked) {
        // Source photo missed. Leave this row for a later Unsplash run and keep
        // scanning: source-photo hits do not consume the Unsplash quota or this slot.
        continue;
      }
      if (!accessKey) {
        taken += 1;
        finishChange(report, change, item, queries, options.apply, log);
        continue;
      }
      try {
        const picked = await pickUniqueCover({
          title: row.title,
          categorySlug: row.category?.slug,
          slug: row.slug,
          personName: row.personName,
          company: row.company,
          excerpt: row.excerpt,
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
          unsplashBlocked = true;
          report.stoppedReason =
            "Unsplash rate limit reached — rerun later; finished rows are skipped automatically.";
          taken += 1;
          finishChange(report, change, item, queries, options.apply, log);
          continue;
        }
        change.error = err instanceof Error ? err.message : String(err);
      }
    }

    if (options.apply && change.newCover !== null && !change.error) {
      const values: Record<string, unknown> = { cover_image_url: change.newCover };
      if (change.newSource === "source_photo" && change.alt) values.cover_image_alt = change.alt;
      if (coverPhotoKey(row.featured_image) === item.key) {
        values.featured_image = change.newCover || null;
        if (change.newSource === "source_photo" && change.alt) values.featured_image_alt = change.alt;
      }
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

    taken += 1;
    finishChange(report, change, item, queries, options.apply, log);
  }

  return report;
}

function sourcePageFor(row: BackfillRow) {
  const input = {
    title: row.title,
    slug: row.slug,
    categorySlug: row.category?.slug,
    canonicalUrl: row.canonical_url,
    body: row.body,
  };
  if (!shouldTrySourcePhoto(input)) return null;
  return extractSourceArticleUrl(input);
}

function finishChange(
  report: BackfillReport,
  change: BackfillChange,
  item: CoverReassignment,
  queries: string[],
  apply: boolean,
  log: (line: string) => void,
) {
  report.processed += 1;
  report.changes.push(change);
  log(
    `${change.applied ? "UPDATED" : apply ? "SKIPPED" : "WOULD CHANGE"} ${change.slug ?? change.id} ` +
      `[${change.reason}${item.keeper ? `, keeper: ${item.keeper.title}` : ""}] ` +
      `${change.oldKey} -> ${change.newCover === null ? `(queries: ${queries.slice(0, 3).join(" | ")})` : change.newCover || "neutral card"}` +
      (change.error ? ` ERROR ${change.error}` : ""),
  );
}
