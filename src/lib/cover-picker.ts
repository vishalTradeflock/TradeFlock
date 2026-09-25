/**
 * Publish-time cover selection that never reuses an image already on another
 * story. Server-only (reads every article's cover, calls the Unsplash API).
 * Relative `.ts` imports so scripts/ can run it with `node --experimental-strip-types`.
 */
import {
  buildCoverSearchQueries,
  coverPhotoKey,
  isCoverKeyTaken,
  pickFirstUnusedCover,
} from "./cover-dedupe.ts";

const UNSPLASH_TIMEOUT_MS = 6_000;
const UNSPLASH_PER_PAGE = 30;
const USED_PAGE_SIZE = 1000;

export type UnsplashCandidate = {
  key: string;
  url: string;
  alt: string;
  thumb: string;
  photographer: string;
  photographerUrl: string;
  downloadLocation: string | null;
};

export type PickedCover = {
  url: string;
  key: string;
  source: "preferred" | "unsplash";
  query?: string;
  alt?: string;
};

export class UnsplashRateLimitError extends Error {
  constructor() {
    super("Unsplash rate limit reached");
    this.name = "UnsplashRateLimitError";
  }
}

/** Minimal shape of the Supabase query builder we need (admin or public client). */
type CoverQuery = {
    select: (columns: string) => {
      order: (column: string, options: { ascending: boolean }) => {
        range: (from: number, to: number) => PromiseLike<{
          data: unknown[] | null;
          error: { message: string } | null;
        }>;
      };
    };
};

/** Any Supabase client (admin, public, or plain supabase-js in scripts). */
export type CoverReader = { from: (table: "articles") => unknown };

/**
 * Every cover identity already used by any article (all statuses), optionally
 * ignoring one article (the one being published/edited).
 */
export async function loadUsedCoverKeys(
  client: CoverReader,
  options: { excludeId?: string | null } = {},
): Promise<Set<string>> {
  const used = new Set<string>();
  for (let from = 0; ; from += USED_PAGE_SIZE) {
    const { data, error } = await (client.from("articles") as CoverQuery)
      .select("id, cover_image_url, featured_image")
      .order("id", { ascending: true })
      .range(from, from + USED_PAGE_SIZE - 1);
    if (error) throw new Error(`Could not load existing covers: ${error.message}`);
    const rows = (data ?? []) as {
      id: string;
      cover_image_url?: string | null;
      featured_image?: string | null;
    }[];
    for (const row of rows) {
      if (options.excludeId && row.id === options.excludeId) continue;
      for (const url of [row.cover_image_url, row.featured_image]) {
        const key = coverPhotoKey(url);
        if (key) used.add(key);
      }
    }
    if (rows.length < USED_PAGE_SIZE) break;
  }
  return used;
}

/** Stable hotlink for a picked Unsplash photo (Unsplash requires hotlinking). */
function unsplashCoverUrl(raw: string) {
  try {
    const parsed = new URL(raw);
    const ixid = parsed.searchParams.get("ixid");
    const base = `https://${parsed.hostname}${parsed.pathname}?auto=format&fit=crop&w=1600&q=80`;
    return ixid ? `${base}&ixid=${encodeURIComponent(ixid)}` : base;
  } catch {
    return raw;
  }
}

/** One page of Unsplash search results (landscape, no Unsplash+ premium photos). */
export async function searchUnsplash(
  query: string,
  page: number,
  accessKey: string,
  perPage = UNSPLASH_PER_PAGE,
): Promise<UnsplashCandidate[]> {
  const url =
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}` +
    `&page=${page}&per_page=${perPage}&orientation=landscape&content_filter=high`;
  const response = await fetch(url, {
    headers: { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" },
    cache: "no-store",
    signal: AbortSignal.timeout(UNSPLASH_TIMEOUT_MS),
  });
  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    if (response.status === 429 || remaining === "0") throw new UnsplashRateLimitError();
  }
  if (!response.ok) throw new Error(`Unsplash search failed (${response.status})`);

  const payload = (await response.json()) as {
    results?: Array<{
      id: string;
      alt_description: string | null;
      premium?: boolean;
      sponsorship?: unknown;
      urls: { raw?: string; regular?: string; small?: string };
      links?: { download_location?: string };
      user: { name: string; links: { html: string } };
    }>;
  };

  return (payload.results ?? []).flatMap((photo) => {
    if (photo.premium || photo.sponsorship) return [];
    const raw = photo.urls.raw || photo.urls.regular;
    if (!raw || !/^https:\/\/images\.unsplash\.com\//.test(raw)) return [];
    const coverUrl = unsplashCoverUrl(raw);
    const key = coverPhotoKey(coverUrl);
    if (!key) return [];
    return [
      {
        key,
        url: coverUrl,
        alt: photo.alt_description ?? `Photo by ${photo.user.name} on Unsplash`,
        thumb: photo.urls.small || coverUrl,
        photographer: photo.user.name,
        photographerUrl: photo.user.links.html,
        downloadLocation: photo.links?.download_location ?? null,
      },
    ];
  });
}

/** Unsplash API guideline: ping download_location when a photo is used. Best effort. */
async function trackUnsplashDownload(location: string | null, accessKey: string) {
  if (!location) return;
  try {
    await fetch(location, {
      headers: { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" },
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    /* non-fatal */
  }
}

/**
 * Pick a cover no other story uses.
 * 1. Preferred URLs (RSS enclosure, og:image, editor's body image) if unused.
 * 2. Unsplash search with story-specific queries, paging past used photos.
 * Returns null when nothing unused was found — callers store "" and the site
 * renders the neutral branded card (never a shared stock photo). Throws
 * UnsplashRateLimitError, or the last error if every search failed.
 * The picked key is added to `used` so batch callers stay unique.
 */
export async function pickUniqueCover(input: {
  title: string;
  categorySlug?: string | null;
  preferred?: readonly (string | null | undefined)[];
  used: Set<string>;
  accessKey?: string | null;
  maxPagesPerQuery?: number;
  queries?: readonly string[];
  /** Ping Unsplash's download endpoint for the chosen photo (off for dry runs). */
  trackDownload?: boolean;
}): Promise<PickedCover | null> {
  const fromSource = pickFirstUnusedCover(input.preferred ?? [], input.used);
  if (fromSource) {
    input.used.add(fromSource.key);
    return { ...fromSource, source: "preferred" };
  }

  const accessKey = input.accessKey?.trim();
  if (!accessKey) return null;

  const queries = input.queries ?? buildCoverSearchQueries(input.title, input.categorySlug);
  const maxPages = Math.max(1, input.maxPagesPerQuery ?? 3);
  let searched = 0;
  let lastError: unknown = null;
  for (const query of queries) {
    for (let page = 1; page <= maxPages; page += 1) {
      let results: UnsplashCandidate[];
      try {
        results = await searchUnsplash(query, page, accessKey);
        searched += 1;
      } catch (err) {
        if (err instanceof UnsplashRateLimitError) throw err;
        lastError = err;
        break; // try the next query
      }
      const hit = results.find((candidate) => !isCoverKeyTaken(candidate.key, input.used));
      if (hit) {
        input.used.add(hit.key);
        if (input.trackDownload !== false) await trackUnsplashDownload(hit.downloadLocation, accessKey);
        return { url: hit.url, key: hit.key, source: "unsplash", query, alt: hit.alt };
      }
      if (results.length < UNSPLASH_PER_PAGE) break; // no more pages for this query
    }
  }
  // Every search failed: that's an outage, not "no unused photo exists".
  if (searched === 0 && lastError) {
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
  return null;
}

/** Postgres unique-violation on the cover index (see 20260925_unique_cover_photo.sql). */
export function isCoverUniqueViolation(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return (
    (error.code === "23505" || /duplicate key/i.test(error.message ?? "")) &&
    /articles_published_cover_key_unique|cover_photo_key/i.test(error.message ?? "")
  );
}
