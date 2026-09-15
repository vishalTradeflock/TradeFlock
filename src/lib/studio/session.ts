import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export const STUDIO_ROLES = ["writer", "editor", "admin"] as const;

export type StudioRole = (typeof STUDIO_ROLES)[number];

export type StudioProfile = Database["public"]["Tables"]["profiles"]["Row"];

export type StudioSession = {
  userId: string;
  email: string | null;
  profile: StudioProfile;
};

function isStudioRole(role: string): role is StudioRole {
  return STUDIO_ROLES.includes(role as StudioRole);
}

export async function getAuthUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

export async function getStudioSession(): Promise<StudioSession | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !profile || !isStudioRole(profile.role)) return null;

    return {
      userId: user.id,
      email: user.email ?? null,
      profile,
    };
  } catch {
    return null;
  }
}

export async function requireStudioSession() {
  const session = await getStudioSession();
  if (!session) redirect("/studio/login");
  return session;
}
