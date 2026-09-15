"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { StudioInviteStaff } from "@/components/studio/StudioInviteStaff";
import { signOutStudioClient } from "@/lib/studio/browser-auth";
import { cn } from "@/lib/utils";

export function StudioTopBar({
  status,
  email,
  onSignOut,
  canInvite,
}: {
  status?: string;
  email?: string | null;
  onSignOut?: boolean;
  canInvite?: boolean;
}) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div>
          <Link href="/studio" className="font-serif text-lg font-semibold tracking-tight hover:text-[#c41e3a]">
            TradeFlock Studio
          </Link>
          {status ? (
            <p className="text-[11px] uppercase tracking-widest text-neutral-500">{status}</p>
          ) : (
            <p className="text-[11px] uppercase tracking-widest text-neutral-500">
              {email ?? "Newsroom desk"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/studio"
            className="h-8 px-2 text-[11px] font-semibold uppercase tracking-widest leading-8 hover:text-[#c41e3a]"
          >
            Desk
          </Link>
          <Link
            href="/studio/write"
            className={cn(
              "h-8 border border-neutral-200 px-3 text-[11px] font-semibold uppercase tracking-widest leading-8 hover:text-[#c41e3a]",
            )}
          >
            Write
          </Link>
          {canInvite ? <StudioInviteStaff /> : null}
          {onSignOut !== false ? (
            <button
              type="button"
              className="h-8 px-2 text-[11px] uppercase tracking-widest text-neutral-500 hover:text-neutral-900"
              onClick={async () => {
                await signOutStudioClient();
                router.replace("/studio/login");
              }}
            >
              Sign out
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
