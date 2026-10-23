import { createClient } from "@supabase/supabase-js";
import { PAGE_REVALIDATE_SECONDS } from "@/lib/cache";
import { SITEMAP_CACHE_TAG } from "@/lib/sitemap-tag";
import type { Database } from "@/lib/supabase/database.types";

type PublicClientOptions = {
  /**
   * Abort each PostgREST request after this many milliseconds and disable
   * automatic retries. Used by the sitemap so a hung read cannot pin the
   * function until the platform kills it.
   */
  timeoutMs?: number;
  /**
   * `page` (default) caches for the once-a-day backstop. Pass `tags` for a
   * single story (`article:<slug>`). Do not attach a tag shared by every
   * public page: expiring it rewrites the archive.
   * `sitemap` uses the same one-day window under `SITEMAP_CACHE_TAG`.
   * Publish expires that tag immediately (`expire: 0`). The window is the
   * backstop so a missed publish still refetches. The revalidate value has
   * to be set: a route handler treats a missing cache mode as uncached.
   */
  cache?: "page" | "sitemap";
  /** Extra Data Cache tags for a page read. Ignored for the sitemap client. */
  tags?: readonly string[];
};

/**
 * Cookie-free anon client for public reads so article pages can ISR.
 * The cookie SSR client opts the route into dynamic rendering.
 */
export function createPublicClient(options?: PublicClientOptions) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const timeoutMs = options?.timeoutMs;
  const timed = typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0;
  const sitemapCache = options?.cache === "sitemap";
  const pageTags = (options?.tags ?? []).filter((tag) => tag.length > 0 && tag.length <= 256);

  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    ...(timed ? { db: { timeout: timeoutMs, retry: false } } : {}),
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          next: sitemapCache
            ? {
                revalidate: PAGE_REVALIDATE_SECONDS,
                tags: [SITEMAP_CACHE_TAG],
              }
            : pageTags.length
              ? {
                  revalidate: PAGE_REVALIDATE_SECONDS,
                  tags: [...pageTags],
                }
              : {
                  revalidate: PAGE_REVALIDATE_SECONDS,
                },
        }),
    },
  });
}
