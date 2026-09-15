import { createClient } from "@/lib/supabase/client";

export async function signOutStudioClient() {
  const supabase = createClient();
  await supabase.auth.signOut();
}
