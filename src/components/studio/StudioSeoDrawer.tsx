"use client";

import { useEffect } from "react";
import {
  PUBLIC_SITE_HOST,
  SEO_DESCRIPTION_LIMIT,
  SEO_TITLE_LIMIT,
  previewSlug,
  resolveSeoDescription,
  resolveSeoTitle,
} from "@/lib/studio/seo";
import { cn } from "@/lib/utils";

const inputClass =
  "mt-1 w-full border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#c41e3a]";

export function StudioSeoDrawer({
  open,
  onClose,
  title,
  slug,
  opening,
  metaTitle,
  metaDescription,
  onMetaTitleChange,
  onMetaDescriptionChange,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  slug: string;
  opening: string;
  metaTitle: string;
  metaDescription: string;
  onMetaTitleChange: (value: string) => void;
  onMetaDescriptionChange: (value: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const previewTitle = resolveSeoTitle(metaTitle, title);
  const previewDescription = resolveSeoDescription(metaDescription, opening);
  const pathSlug = previewSlug(slug, title);
  const displayUrl = `${PUBLIC_SITE_HOST} › news › ${pathSlug}`;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close settings"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-seo-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-neutral-200 bg-white"
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#c41e3a]">
              Settings
            </p>
            <h2 id="studio-seo-title" className="mt-1 font-serif text-2xl font-semibold tracking-tight">
              SEO
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500 hover:text-[#c41e3a]"
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <label className="block">
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                SEO title
              </span>
              <SeoCount value={metaTitle} limit={SEO_TITLE_LIMIT} />
            </span>
            <input
              value={metaTitle}
              onChange={(event) => onMetaTitleChange(event.target.value)}
              placeholder={title.trim() || "Falls back to the headline"}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-neutral-500">
              Leave blank to use the post title. Aim for about {SEO_TITLE_LIMIT} characters.
            </p>
          </label>

          <label className="block">
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                SEO description
              </span>
              <SeoCount value={metaDescription} limit={SEO_DESCRIPTION_LIMIT} />
            </span>
            <textarea
              rows={4}
              value={metaDescription}
              onChange={(event) => onMetaDescriptionChange(event.target.value)}
              placeholder={opening.trim() || "Falls back to the opening paragraph"}
              className={cn(inputClass, "resize-y")}
            />
            <p className="mt-1 text-xs text-neutral-500">
              Leave blank to use the opening paragraph. Aim for about {SEO_DESCRIPTION_LIMIT}{" "}
              characters.
            </p>
          </label>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
              Google search preview
            </p>
            <div className="mt-2 border border-neutral-200 bg-white px-3 py-3">
              <p className="truncate text-[13px] text-[#006621]">{displayUrl}</p>
              <p className="mt-1 font-serif text-xl leading-6 text-[#1a0dab]">
                {serpsTruncate(`${previewTitle} | TradeFlock USA`, SEO_TITLE_LIMIT + 18)}
              </p>
              <p className="mt-1 text-sm leading-5 text-[#4d5156]">
                {serpsTruncate(
                  previewDescription || "The dek that will appear under this result.",
                  SEO_DESCRIPTION_LIMIT,
                )}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function SeoCount({ value, limit }: { value: string; limit: number }) {
  const count = value.trim().length;
  return (
    <span
      className={cn(
        "text-[11px] tabular-nums tracking-widest",
        count === 0 ? "text-neutral-400" : count > limit ? "text-[#c41e3a]" : "text-neutral-500",
      )}
    >
      {count}/{limit}
    </span>
  );
}

function serpsTruncate(text: string, limit: number) {
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`;
}
