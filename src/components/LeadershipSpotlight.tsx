"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import SafeArticleImage from "@/components/SafeArticleImage";
import type { ArticleListCard } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 3;

export default function LeadershipSpotlight({
  articles,
}: {
  articles: ArticleListCard[];
}) {
  const [page, setPage] = useState(0);
  if (!articles.length) return null;

  const pageCount = Math.ceil(articles.length / PAGE_SIZE);
  const safePage = Math.min(page, pageCount - 1);
  const visible = articles.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const atStart = safePage === 0;
  const atEnd = (safePage + 1) * PAGE_SIZE >= articles.length;

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-2xl font-semibold tracking-tight">
          Leadership spotlights
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous spotlights"
            disabled={atStart}
            className={cn(
              "border border-neutral-200 p-1.5 text-neutral-800",
              atStart ? "cursor-not-allowed opacity-30" : "hover:text-[#c41e3a]",
            )}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next spotlights"
            disabled={atEnd}
            className={cn(
              "border border-neutral-200 p-1.5 text-neutral-800",
              atEnd ? "cursor-not-allowed opacity-30" : "hover:text-[#c41e3a]",
            )}
            onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-5 grid gap-6 sm:grid-cols-3">
        {visible.map((article) => (
          <Link
            key={article.id}
            href={`/news/${article.slug}`}
            className="group border-t border-neutral-200 pt-4"
          >
            <div className="relative aspect-[16/10] overflow-hidden bg-neutral-100">
              <SafeArticleImage
                src={article.cover_image_url}
                alt={article.cover_image_alt}
                fill
                sizes="(min-width: 640px) 33vw, 100vw"
                loading="lazy"
              />
            </div>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c41e3a]">
              {article.categoryName}
            </p>
            <h3 className="mt-1 font-serif text-lg font-semibold leading-snug tracking-tight group-hover:text-[#c41e3a]">
              {article.title}
            </h3>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-neutral-600">
              {article.excerpt}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
