"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { ArticleListCard } from "@/lib/types";
import { cn, formatShortDate } from "@/lib/utils";

const PAGE_SIZE = 6;

export default function GrowthStrategies({
  articles,
}: {
  articles: ArticleListCard[];
}) {
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(articles.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleStories = articles.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const atStart = safePage === 0;
  const atEnd = !articles.length || (safePage + 1) * PAGE_SIZE >= articles.length;

  return (
    <section className="mt-10 border-t border-neutral-200 pt-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-2xl font-semibold tracking-tight">
          Growth strategies
        </h2>
        {articles.length ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous strategies"
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
              aria-label="Next strategies"
              disabled={atEnd}
              className={cn(
                "border border-neutral-200 p-1.5 text-neutral-800",
                atEnd ? "cursor-not-allowed opacity-30" : "hover:text-[#c41e3a]",
              )}
              onClick={() =>
                setPage((current) => Math.min(pageCount - 1, current + 1))
              }
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
      {visibleStories.length ? (
        <ul className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
          {visibleStories.map((article) => (
            <li key={article.id} className="py-4">
              <Link href={`/news/${article.slug}`} className="group block">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  {article.categoryName}
                  <span className="mx-2">·</span>
                  {formatShortDate(article.published_at)}
                </p>
                <h3 className="mt-1 font-serif text-xl font-semibold tracking-tight group-hover:text-[#c41e3a]">
                  {article.title}
                </h3>
                <p className="mt-1 text-sm leading-6 text-neutral-600">
                  {article.excerpt}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-neutral-700">
          This desk will carry playbooks from operators who have already
          made the hard calls — capital, talent, and the unglamorous work of
          compounding. More growth packages land here as they clear the
          edit.
        </p>
      )}
    </section>
  );
}
