import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only client for the Phase 1 newsroom tables (not in the generated
 * Database types yet). Runs inside the newsroom API, never handed to assistants:
 * assistants authenticate with per-role tokens (src/lib/newsroom/roles.ts).
 * Publishing still goes through the DB editorial gate trigger, which applies to
 * the service role too.
 */
export function newsroomDb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
