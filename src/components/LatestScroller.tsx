"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import SafeArticleImage from "@/components/SafeArticleImage";
import type { ArticleWithRelations } from "@/lib/types";
import { LATEST_SCROLLER_LIMIT } from "@/lib/cache";
import { cn, formatShortDate } from "@/lib/utils";

const PAGE_SIZE = 3;

export default function LatestScroller({
  articles,
}: {
  articles: ArticleWithRelations[];
}) {
  const capped = useMemo(
    () => articles.slice(0, LATEST_SCROLLER_LIMIT),
    [articles],
  );
  const pages = useMemo(() => {
    const chunks: ArticleWithRelations[][] = [];
    for (let i = 0; i < capped.length; i += PAGE_SIZE) {
      chunks.push(capped.slice(i, i + PAGE_SIZE));
    }
    return chunks;
  }, [capped]);

  const [page, setPage] = useState(0);
  if (!capped.length) return null;

  const safePage = Math.min(page, pages.length - 1);
  const atStart = safePage <= 0;
  const atEnd = safePage >= pages.length - 1;

  return (
    <section>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h3 className="text-2xl font-bold uppercase tracking-wide">The Latest</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous stories"
            disabled={atStart}
            className={cn(
              "border border-neutral-200 p-1.5 text-neutral-800",
              atStart ? "cursor-not-allowed opacity-30" : "hover:text-[#c41e3a]",
            )}
            onClick={() => setPage((currentPage) => Math.max(0, currentPage - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next stories"
            disabled={atEnd}
            className={cn(
              "border border-neutral-200 p-1.5 text-neutral-800",
              atEnd ? "cursor-not-allowed opacity-30" : "hover:text-[#c41e3a]",
            )}
            onClick={() =>
              setPage((currentPage) => Math.min(pages.length - 1, currentPage + 1))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{
            width: `${pages.length * 100}%`,
            transform: `translateX(-${safePage * (100 / pages.length)}%)`,
          }}
        >
          {pages.map((chunk, pageIndex) => (
            <div
              key={chunk.map((article) => article.id).join("-") || pageIndex}
              className="grid grid-cols-1 gap-6 md:grid-cols-3"
              style={{ width: `${100 / pages.length}%` }}
            >
              {chunk.map((article) => (
                <LatestCard key={article.id} article={article} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LatestCard({ article }: { article: ArticleWithRelations }) {
  return (
    <Link href={`/news/${article.slug}`} className="group block">
      <div className="relative mb-3 aspect-[16/9] w-full overflow-hidden rounded-md bg-neutral-100">
        <SafeArticleImage
          src={article.cover_image_url}
          alt={article.cover_image_alt}
          fill
          sizes="(min-width: 768px) 33vw, 100vw"
          className="object-cover"
        />
      </div>
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c41e3a]">
          {article.category.name}
        </p>
        <time dateTime={article.published_at} className="text-[11px] text-muted-foreground">
          {formatShortDate(article.published_at)}
        </time>
      </div>
      <h4 className="mt-1 line-clamp-2 text-base font-semibold leading-snug group-hover:underline">
        {article.title}
      </h4>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{article.excerpt}</p>
      <p className="mt-3 text-[11px] text-muted-foreground">{article.author.name}</p>
    </Link>
  );
}
