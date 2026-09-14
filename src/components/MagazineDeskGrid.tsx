"use client";

import Link from "next/link";
import { useState } from "react";
import MagazineCover from "@/components/MagazineCover";
import type { Magazine } from "@/lib/types";
import { formatShortDate } from "@/lib/utils";

const PAGE_SIZE = 12;

export default function MagazineDeskGrid({ magazines }: { magazines: Magazine[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const shown = magazines.slice(0, visible);

  return (
    <>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((magazine) => (
          <article key={magazine.id} className="min-w-0">
            <Link href={`/magazine/${magazine.slug}`} className="block">
              <MagazineCover
                pdfUrl={magazine.pdf_url}
                title={magazine.title}
                publishedAt={magazine.published_at}
                coverImageUrl={magazine.cover_image_url}
              />
            </Link>
            <h2 className="mt-3 font-serif text-lg font-semibold leading-snug tracking-tight">
              <Link href={`/magazine/${magazine.slug}`} className="hover:text-[#c41e3a]">
                {magazine.title}
              </Link>
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              {formatShortDate(magazine.published_at)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link
                href={`/magazine/${magazine.slug}`}
                className="rounded bg-[#c41e3a] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                Read Flipbook
              </Link>
              {magazine.pdf_url ? (
                <a
                  href={magazine.pdf_url}
                  className="text-xs text-muted-foreground hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Download PDF
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {visible < magazines.length ? (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            className="border border-neutral-200 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-neutral-700 hover:text-[#c41e3a]"
            onClick={() => setVisible((count) => count + PAGE_SIZE)}
          >
            Load More
          </button>
        </div>
      ) : null}
    </>
  );
}
