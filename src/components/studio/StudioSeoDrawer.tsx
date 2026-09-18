"use client";

import { useEffect } from "react";
import type { StudioAuthor, StudioFaqDraft } from "@/components/studio/types";
import { ALT_TEXT_MAX } from "@/lib/studio/head-meta";
import {
  SEO_DESCRIPTION_LIMIT,
  SEO_TITLE_LIMIT,
  previewSlug,
  resolveSeoDescription,
  resolveSeoTitle,
} from "@/lib/studio/seo";
import { getSiteHost } from "@/lib/site-url";
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
  onSlugChange,
  published,
  onCommitSlug,
  authors,
  authorId,
  onAuthorIdChange,
  coverImageAlt,
  onCoverImageAltChange,
  faqs,
  onFaqsChange,
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
  onSlugChange: (value: string) => void;
  published: boolean;
  onCommitSlug: () => void;
  authors: StudioAuthor[];
  authorId: string;
  onAuthorIdChange: (value: string) => void;
  coverImageAlt: string;
  onCoverImageAltChange: (value: string) => void;
  faqs: StudioFaqDraft[];
  onFaqsChange: (value: StudioFaqDraft[]) => void;
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
  const displayUrl = `${getSiteHost()} › news › ${pathSlug}`;

  function moveFaq(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= faqs.length) return;
    const copy = [...faqs];
    const [row] = copy.splice(index, 1);
    copy.splice(next, 0, row);
    onFaqsChange(copy);
  }

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

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
              Public URL
            </p>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                Slug
              </span>
              <input
                value={slug}
                onChange={(event) => onSlugChange(event.target.value)}
                placeholder="apple-announces-new-ai-strategy"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-neutral-500">
                Live URL: https://{getSiteHost()}/{pathSlug || "…"}. Changing the title does not
                change this. {published ? "Saving a new slug on a published story adds a permanent redirect from the old URL." : ""}
              </p>
            </label>
            {published ? (
              <button
                type="button"
                onClick={onCommitSlug}
                className="h-8 border border-neutral-200 px-3 text-[11px] font-semibold uppercase tracking-widest hover:text-[#c41e3a]"
              >
                Update public URL
              </button>
            ) : null}
          </section>

          <section className="space-y-4 border-t border-neutral-200 pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
              Byline
            </p>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                Author
              </span>
              <select
                value={authorId}
                onChange={(event) => onAuthorIdChange(event.target.value)}
                className={inputClass}
              >
                {authors.map((author) => (
                  <option key={author.id} value={author.id}>
                    {author.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-neutral-500">
                Shown on the story and in Article structured data. Edit bios on Studio → Settings.
              </p>
            </label>
          </section>

          <section className="space-y-4 border-t border-neutral-200 pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
              Featured image
            </p>
            <label className="block">
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                  Alt text
                </span>
                <SeoCount value={coverImageAlt} limit={ALT_TEXT_MAX} />
              </span>
              <input
                value={coverImageAlt}
                onChange={(event) => onCoverImageAltChange(event.target.value)}
                placeholder="Describe the photograph. Leave blank if decorative."
                className={inputClass}
                maxLength={ALT_TEXT_MAX}
              />
            </label>
          </section>

          <section className="space-y-4 border-t border-neutral-200 pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
              Search listing
            </p>
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
          </section>

          <section className="space-y-4 border-t border-neutral-200 pt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                FAQ
              </p>
              <button
                type="button"
                className="text-[11px] font-semibold uppercase tracking-widest hover:text-[#c41e3a]"
                onClick={() => onFaqsChange([...faqs, { question: "", answer: "" }])}
              >
                Add FAQ
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              Optional. Only complete question-and-answer pairs are published. Do not invent FAQs.
            </p>
            {faqs.map((faq, index) => (
              <div key={`faq-${index}`} className="border border-neutral-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                    {index + 1}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-[11px] uppercase tracking-widest text-neutral-500 disabled:opacity-40"
                      disabled={index === 0}
                      onClick={() => moveFaq(index, -1)}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="text-[11px] uppercase tracking-widest text-neutral-500 disabled:opacity-40"
                      disabled={index === faqs.length - 1}
                      onClick={() => moveFaq(index, 1)}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className="text-[11px] uppercase tracking-widest text-[#c41e3a]"
                      onClick={() => onFaqsChange(faqs.filter((_, i) => i !== index))}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <input
                  value={faq.question}
                  onChange={(event) => {
                    const copy = [...faqs];
                    copy[index] = { ...copy[index], question: event.target.value };
                    onFaqsChange(copy);
                  }}
                  placeholder="Question"
                  className={inputClass}
                />
                <textarea
                  rows={3}
                  value={faq.answer}
                  onChange={(event) => {
                    const copy = [...faqs];
                    copy[index] = { ...copy[index], answer: event.target.value };
                    onFaqsChange(copy);
                  }}
                  placeholder="Answer"
                  className={cn(inputClass, "resize-y")}
                />
              </div>
            ))}
          </section>
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
