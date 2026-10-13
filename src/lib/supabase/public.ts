import { createClient } from "@supabase/supabase-js";
import { PAGE_REVALIDATE_SECONDS } from "@/lib/cache";
import { PUBLISHED_PAGES_CACHE_TAG, SITEMAP_CACHE_TAG } from "@/lib/sitemap-tag";
import type { Database } from "@/lib/supabase/database.types";

type PublicClientOptions = {
  /**
   * Abort each PostgREST request after this many milliseconds and disable
   * automatic retries. Used by the sitemap so a hung read cannot pin the
   * function until the platform kills it.
   */
  timeoutMs?: number;
  /**
   * `page` (default) shares the daily public Data Cache under
   * `PUBLISHED_PAGES_CACHE_TAG`. Publish paths expire that tag; the
   * revalidate window is only the once-a-day backstop.
   * `sitemap` is force-cached under `SITEMAP_CACHE_TAG` until a publish
   * expires the tag. It must not use the page window: a dynamic route
   * treats a missing cache mode as uncached, which would read Supabase
   * on every sitemap request.
   */
  cache?: "page" | "sitemap";
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
          ...(sitemapCache
            ? {
                cache: "force-cache",
                next: { tags: [SITEMAP_CACHE_TAG], revalidate: false },
              }
            : {
                next: {
                  revalidate: PAGE_REVALIDATE_SECONDS,
                  tags: [PUBLISHED_PAGES_CACHE_TAG],
                },
              }),
        }),
    },
  });
}
