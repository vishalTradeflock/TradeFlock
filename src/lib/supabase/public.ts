import { createClient } from "@supabase/supabase-js";
import { ARTICLE_REVALIDATE_SECONDS } from "@/lib/cache";
import type { Database } from "@/lib/supabase/database.types";

type PublicClientOptions = {
  /**
   * Abort each PostgREST request after this many milliseconds and disable
   * automatic retries. Used by the sitemap so a hung read cannot pin the
   * function until the platform kills it.
   */
  timeoutMs?: number;
  /** Seconds for the Next fetch cache. Defaults to the article window so a shared read cannot pull every route down to the listing interval. */
  revalidate?: number;
  /** Narrow cache tags. Do not put a tag here that is also used by every article page. */
  tags?: string[];
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
  const revalidate = options?.revalidate ?? ARTICLE_REVALIDATE_SECONDS;
  const tags = options?.tags?.map((tag) => tag.trim()).filter(Boolean);

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
          next: {
            revalidate,
            ...(tags?.length ? { tags } : {}),
          },
        }),
    },
  });
}
