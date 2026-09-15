import "server-only";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  isModerator,
  isStudioRole,
  normalizeStudioRole,
  studioHomePath,
  type StudioRole,
} from "@/lib/studio/roles";

export type { StudioRole } from "@/lib/studio/roles";
export { isMasthead, isModerator, STUDIO_ROLES, studioHomePath } from "@/lib/studio/roles";

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

type ProfileRow = {
  id: string;
  role: string;
  display_name?: string | null;
};

function asStudioProfile(row: ProfileRow | null): StudioProfile | null {
  if (!row) return null;
  const role = normalizeStudioRole(row.role);
  if (!isStudioRole(role)) return null;
  return {
    id: row.id,
    role,
    display_name: row.display_name ?? null,
  };
}

async function loadProfileRow(
  userId: string,
  userClient: Awaited<ReturnType<typeof createClient>>,
) {
  try {
    const admin = createAdminClient();
    const byId = await admin
      .from("profiles")
      .select("id, role, display_name")
      .eq("id", userId)
      .maybeSingle();
    if (byId.data) return byId.data as ProfileRow;

    const byUserId = await admin
      .from("profiles")
      .select("id, role, display_name")
      .filter("user_id", "eq", userId)
      .maybeSingle();
    if (!byUserId.error && byUserId.data) return byUserId.data as ProfileRow;
  } catch {
    // Fall through to the signed-in client if the service role is missing.
  }

  const full = await userClient
    .from("profiles")
    .select("id, role, display_name")
    .eq("id", userId)
    .maybeSingle();
  if (!full.error && full.data) return full.data as ProfileRow;

  const slim = await userClient.from("profiles").select("id, role").eq("id", userId).maybeSingle();
  if (!slim.error && slim.data) return slim.data as ProfileRow;

  return null;
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

    const row = await loadProfileRow(user.id, supabase);
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

export async function requireModeratorSession() {
  const session = await requireStudioSession();
  if (!isModerator(session.profile.role)) redirect("/studio/write");
  return session;
}

export function redirectToStudioHome(role: StudioRole): never {
  redirect(studioHomePath(role));
}
