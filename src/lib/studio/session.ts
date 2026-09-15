import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const STUDIO_ROLES = ["writer", "editor", "admin"] as const;

export type StudioRole = (typeof STUDIO_ROLES)[number];

export type StudioProfile = {
  id: string;
  role: StudioRole;
  display_name: string | null;
};

export type StudioSession = {
  userId: string;
  email: string | null;
  profile: StudioProfile;
};

function isStudioRole(role: string): role is StudioRole {
  return STUDIO_ROLES.includes(role as StudioRole);
}

function asStudioProfile(row: {
  id: string;
  role: string;
  display_name?: string | null;
} | null): StudioProfile | null {
  if (!row || !isStudioRole(row.role)) return null;
  return {
    id: row.id,
    role: row.role,
    display_name: row.display_name ?? null,
  };
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

    const full = await supabase
      .from("profiles")
      .select("id, role, display_name")
      .eq("id", user.id)
      .maybeSingle();

    const row = full.error
      ? (
          await supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle()
        ).data
      : full.data;

    const profile = asStudioProfile(row);
    if (!profile) return null;

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
