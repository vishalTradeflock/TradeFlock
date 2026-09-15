import type { Metadata } from "next";
import { redirect } from "next/navigation";
import StudioLoginForm from "@/components/studio/StudioLoginForm";
import { getAuthUser, getStudioSession } from "@/lib/studio/session";
import { studioHomePath } from "@/lib/studio/roles";
import { isSupabaseConfigured } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Studio login",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudioLoginPage() {
  const session = await getStudioSession();
  if (session) redirect(studioHomePath(session.profile.role));

  const user = await getAuthUser();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c41e3a]">
        Newsroom
      </p>
      <h1 className="mt-2 font-serif text-4xl font-bold tracking-tight">TradeFlock Studio</h1>
      <p className="mt-3 text-sm leading-6 text-neutral-600">
        A quiet desk for drafts, photographs, and the next edition.
      </p>
      {!isSupabaseConfigured() ? (
        <p className="mt-8 text-sm text-neutral-600">
          Supabase is not configured in this environment.
        </p>
      ) : (
        <StudioLoginForm forbidden={Boolean(user)} />
      )}
    </main>
  );
}
