"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { EDITORIAL_COVERS, coverIdentity } from "@/lib/images";
import type { ArticleWithRelations } from "@/lib/types";
import { cn, formatShortDate } from "@/lib/utils";

const PAGE_SIZE = 3;

const LATEST_POOL_EXTRAS = [
  "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1526304640173-94cb2232017e?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1542744173-8eaa342cf346?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80",
];

function uniqueByPhoto(urls: readonly string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const url of urls) {
    const id = coverIdentity(url);
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(url);
  }
  return unique;
}

const UNIQUE_NEWS_IMAGES = uniqueByPhoto([...LATEST_POOL_EXTRAS, ...EDITORIAL_COVERS]);

function assignUniqueLatestImages(articles: ArticleWithRelations[]) {
  const used = new Set<string>();
  return articles.map((_, idx) => {
    // Never reuse a photo ID across this scroller — CMS covers collide too often.
    for (let step = 0; step < UNIQUE_NEWS_IMAGES.length; step += 1) {
      const candidate = UNIQUE_NEWS_IMAGES[(idx + step) % UNIQUE_NEWS_IMAGES.length];
      const candidateId = coverIdentity(candidate);
      if (!used.has(candidateId)) {
        used.add(candidateId);
        return candidate;
      }
    }
    return UNIQUE_NEWS_IMAGES[idx % UNIQUE_NEWS_IMAGES.length];
  });
}

export default function LatestScroller({
  articles,
}: {
  articles: ArticleWithRelations[];
}) {
  const cardImages = useMemo(() => assignUniqueLatestImages(articles), [articles]);

  const pages = useMemo(() => {
    const chunks: ArticleWithRelations[][] = [];
    for (let i = 0; i < articles.length; i += PAGE_SIZE) {
      chunks.push(articles.slice(i, i + PAGE_SIZE));
    }
    return chunks;
  }, [articles]);

  const [page, setPage] = useState(0);
  if (!articles.length) return null;

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
              {chunk.map((article, idx) => {
                const imageIndex = pageIndex * PAGE_SIZE + idx;
                return (
                  <LatestCard
                    key={article.id}
                    article={article}
                    idx={imageIndex}
                    cardImage={cardImages[imageIndex]}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LatestCard({
  article,
  idx,
  cardImage,
}: {
  article: ArticleWithRelations;
  idx: number;
  cardImage: string;
}) {
  return (
    <Link href={`/news/${article.slug}`} className="group block">
      <div className="relative mb-3 aspect-[16/9] w-full overflow-hidden rounded-md bg-neutral-100">
        {/* Native img so 404s swap to the next unused pool photo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cardImage}
          alt={article.cover_image_alt || article.title}
          className="absolute inset-0 h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={(event) => {
            const img = event.currentTarget;
            const attempt = Number(img.dataset.attempt ?? idx) + 1;
            img.dataset.attempt = String(attempt);
            if (attempt >= UNIQUE_NEWS_IMAGES.length) {
              img.onerror = null;
              return;
            }
            img.src = UNIQUE_NEWS_IMAGES[attempt % UNIQUE_NEWS_IMAGES.length];
          }}
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
