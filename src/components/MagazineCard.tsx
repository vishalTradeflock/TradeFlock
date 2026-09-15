"use client";

import Link from "next/link";
import MagazineCover from "@/components/MagazineCover";
import type { Magazine } from "@/lib/types";
import { cn, formatShortDate } from "@/lib/utils";

export default function MagazineCard({
  magazine,
  className,
}: {
  magazine: Magazine;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-xl border border-neutral-200 bg-white p-3.5",
        className,
      )}
    >
      <Link href={`/magazine/${magazine.slug}`} className="block">
        <MagazineCover
          pdfUrl={magazine.pdf_url}
          title={magazine.title}
          publishedAt={magazine.published_at}
          coverImageUrl={magazine.cover_image_url}
        />
      </Link>
      <h3 className="mt-3 mb-1 min-h-[2.5rem] font-serif text-sm font-bold leading-snug text-foreground line-clamp-2">
        <Link href={`/magazine/${magazine.slug}`} className="hover:text-[#c41e3a]">
          {magazine.title}
        </Link>
      </h3>
      <p className="mb-3 text-[11px] text-muted-foreground">
        <time dateTime={magazine.published_at}>
          {formatShortDate(magazine.published_at)}
        </time>
      </p>
      <div className="mt-auto flex w-full items-center gap-1.5 border-t border-neutral-200 pt-3">
        <Link
          href={`/magazine/${magazine.slug}`}
          className="inline-flex h-8 flex-1 select-none items-center justify-center rounded-md border border-neutral-200 bg-white px-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-neutral-800 transition hover:border-[#c41e3a] hover:text-[#c41e3a]"
        >
          Open
        </Link>
        <Link
          href={`/magazine/${magazine.slug}/read`}
          className="inline-flex h-8 flex-1 select-none items-center justify-center whitespace-nowrap rounded-md bg-[#c41e3a] px-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-white transition hover:opacity-90"
        >
          Read Flipbook
        </Link>
        {magazine.pdf_url ? (
          <a
            href={magazine.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            title="Download PDF"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-muted-foreground transition hover:text-foreground"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <span className="sr-only">Download PDF</span>
          </a>
        ) : (
          <span className="h-8 w-8 shrink-0" aria-hidden />
        )}
      </div>
    </article>
  );
}
