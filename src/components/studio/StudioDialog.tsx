"use client";

import { cn } from "@/lib/utils";

export function StudioDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-dialog-title"
        className="w-full max-w-md border border-neutral-200 bg-white p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="studio-dialog-title" className="font-serif text-2xl font-semibold tracking-tight">
            {title}
          </h2>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500 hover:text-[#c41e3a]"
            >
              Close
            </button>
          ) : null}
        </div>
        <div className={cn("mt-4 text-sm leading-6 text-neutral-700")}>{children}</div>
      </div>
    </div>
  );
}
