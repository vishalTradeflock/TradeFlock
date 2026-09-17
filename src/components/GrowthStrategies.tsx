"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { articlePath, type ArticleListCard } from "@/lib/types";
import { cn, formatShortDate } from "@/lib/utils";

const PAGE_SIZE = 8;

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "TF";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function isUsableSrc(url: string) {
  if (!url.trim()) return false;
  if (url.startsWith("/")) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function skipOptimizer(url: string) {
  try {
    const host = new URL(url).hostname;
    return (
      host.endsWith(".supabase.co") ||
      host === "tradeflockusa.com" ||
      host === "www.tradeflockusa.com" ||
      host.endsWith(".tradeflockusa.com")
    );
  } catch {
    return true;
  }
}

function readingMinutes(excerpt: string) {
  const words = excerpt.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(4, Math.min(8, Math.round(words / 12) || 4));
}

function LeaderPortrait({
  src,
  name,
  alt,
}: {
  src: string;
  name: string;
  alt: string;
}) {
  const usable = isUsableSrc(src);
  const [failed, setFailed] = useState(!usable);

  useEffect(() => {
    setFailed(!isUsableSrc(src));
  }, [src]);

  if (failed) {
    return (
      <div
        className="flex h-full w-full items-center justify-center bg-neutral-100 font-serif text-lg font-semibold text-neutral-600"
        aria-hidden
      >
        {initialsFrom(name)}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="80px"
      unoptimized={skipOptimizer(src)}
      className="object-cover transition duration-300 group-hover:scale-105"
      onError={() => setFailed(true)}
    />
  );
}

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
            Leaders to Learn From
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-neutral-600">
            Key takeaways, frameworks, and insights from standout operators.
          </p>
        </div>
        {articles.length ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Previous leaders"
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
              aria-label="Next leaders"
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
        <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          {visibleStories.map((article) => (
            <li key={article.id}>
              <Link
                href={articlePath(article.slug)}
                className="group flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-3.5 transition duration-200 hover:border-neutral-400 hover:bg-neutral-50"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg shadow-sm sm:h-20 sm:w-20">
                  <LeaderPortrait
                    src={article.cover_image_url}
                    name={article.authorName}
                    alt={article.cover_image_alt || article.title}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#c41e3a]">
                    {article.categoryName}
                  </p>
                  <h3 className="mt-0.5 font-serif text-sm font-bold text-foreground transition line-clamp-1 group-hover:text-[#c41e3a] sm:text-base">
                    {article.title}
                  </h3>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {article.excerpt}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatShortDate(article.published_at)}
                    <span className="mx-1.5" aria-hidden>
                      ·
                    </span>
                    {readingMinutes(article.excerpt)} min read
                  </p>
                </div>
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
