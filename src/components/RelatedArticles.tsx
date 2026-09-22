"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SafeArticleImage from "@/components/SafeArticleImage";
import { RELATED_CARD } from "@/lib/image-optimization";
import { articleCoverSrc, deskCoverFallback } from "@/lib/images";
import type { ArticleWithRelations } from "@/lib/types";
import { articlePath } from "@/lib/types";
import { formatShortDate } from "@/lib/utils";

const SCROLL_BY = 360;

export function RelatedArticles({
  categoryName,
  articles,
}: {
  categoryName: string;
  articles: ArticleWithRelations[];
}) {
  const desk = categoryName.trim() || "Tech";
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = () => {
    const node = scrollRef.current;
    if (!node) return;
    setCanPrev(node.scrollLeft > 4);
    setCanNext(node.scrollLeft + node.clientWidth < node.scrollWidth - 4);
  };

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    updateArrows();
    node.addEventListener("scroll", updateArrows, { passive: true });
    const observer = new ResizeObserver(updateArrows);
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", updateArrows);
      observer.disconnect();
    };
  }, [articles.length]);

  if (!articles.length) return null;

  const scrollBy = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <section className="my-16 border-t border-neutral-200 pt-12">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-neutral-950">
            More in {desk}
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Latest reporting and perspectives from our {desk} desk.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="Previous related stories"
            disabled={!canPrev}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-900 transition hover:bg-neutral-100 disabled:pointer-events-none disabled:opacity-30"
            onClick={() => scrollBy(-SCROLL_BY)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next related stories"
            disabled={!canNext}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-900 transition hover:bg-neutral-100 disabled:pointer-events-none disabled:opacity-30"
            onClick={() => scrollBy(SCROLL_BY)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth py-2"
      >
        {articles.map((article) => {
          const imageUrl = articleCoverSrc(article);
          const fallbackSrc = deskCoverFallback(article);
          return (
            <Link
              key={article.id}
              href={articlePath(article.slug)}
              className="group w-[280px] max-w-[340px] min-w-[280px] flex-shrink-0 snap-start sm:w-[340px] sm:min-w-[340px]"
            >
              <div className="relative aspect-[16/9] overflow-hidden rounded-lg border border-neutral-200/50">
                <SafeArticleImage
                  src={imageUrl}
                  alt={article.cover_image_alt}
                  width={RELATED_CARD.width}
                  height={RELATED_CARD.height}
                  loading="lazy"
                  fallbackSrc={fallbackSrc === imageUrl ? undefined : fallbackSrc}
                  className="h-full w-full rounded-lg object-cover"
                />
              </div>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[#c41e3a]">
                {article.category.name}
              </p>
              <h3 className="mt-1 font-serif text-base font-bold leading-snug tracking-tight text-neutral-950 line-clamp-2 group-hover:text-[#c41e3a]">
                {article.title}
              </h3>
              <p className="mt-1.5 text-[11px] text-neutral-500">
                {formatShortDate(article.published_at)}
                <span className="mx-1.5">·</span>
                {article.author.name}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
