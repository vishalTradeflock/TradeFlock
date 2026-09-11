import { createClient } from "@supabase/supabase-js";
import { PAGE_REVALIDATE_SECONDS } from "@/lib/cache";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Cookie-free anon client for public reads so article pages can ISR.
 * The cookie SSR client opts the route into dynamic rendering.
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          next: { revalidate: PAGE_REVALIDATE_SECONDS },
        }),
    },
  });
}
