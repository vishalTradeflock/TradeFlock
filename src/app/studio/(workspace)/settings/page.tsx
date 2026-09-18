import { StudioSettingsForm } from "@/components/studio/StudioSettingsForm";
import { StudioTopBar } from "@/components/studio/StudioTopBar";
import { canInviteStaff, canManageSiteSettings } from "@/lib/studio/access";
import { studioAuthorIds } from "@/lib/studio/desk";
import { isModerator } from "@/lib/studio/roles";
import { requireStudioSession } from "@/lib/studio/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function StudioSettingsPage() {
  const session = await requireStudioSession();
  const admin = createAdminClient();
  const ownIds = await studioAuthorIds(session);
  const authorQuery = admin
    .from("authors")
    .select("id, name, slug, bio, title, avatar_url")
    .order("name");
  const authorRows = isModerator(session.profile.role)
    ? (await authorQuery).data
    : (await authorQuery.in("id", ownIds.length ? ownIds : ["00000000-0000-0000-0000-000000000000"])).data;

  const authors = (authorRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    bio: row.bio ?? "",
    title: row.title ?? "",
    avatarUrl: row.avatar_url ?? "",
  }));

  let google = "";
  let bing = "";
  let globalHeadCode = "";
  if (canManageSiteSettings(session.profile.role)) {
    const { data } = await admin
      .from("site_settings")
      .select("google_site_verification, bing_site_verification, global_head_code")
      .eq("id", "default")
      .maybeSingle();
    google = typeof data?.google_site_verification === "string" ? data.google_site_verification : "";
    bing = typeof data?.bing_site_verification === "string" ? data.bing_site_verification : "";
    globalHeadCode = typeof data?.global_head_code === "string" ? data.global_head_code : "";
  }

  return (
    <>
      <StudioTopBar email={session.email} canInvite={canInviteStaff(session.profile.role)} />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#c41e3a]">
          Studio
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">Settings</h1>
        <div className="mt-8">
          <StudioSettingsForm
            canEditVerification={canManageSiteSettings(session.profile.role)}
            google={google}
            bing={bing}
            globalHeadCode={globalHeadCode}
            authors={authors}
            initialAuthorId={authors.find((author) => ownIds.includes(author.id))?.id ?? authors[0]?.id ?? ""}
          />
        </div>
      </main>
    </>
  );
}
