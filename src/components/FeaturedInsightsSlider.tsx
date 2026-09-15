"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SafeArticleImage from "@/components/SafeArticleImage";
import type { ArticleListCard } from "@/lib/types";
import { cn, formatPublishedAt } from "@/lib/utils";

const INTERVAL_MS = 5000;

export default function FeaturedInsightsSlider({
  interviews,
}: {
  interviews: ArticleListCard[];
}) {
  const slides = interviews.slice(0, 10);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const total = slides.length;
  const safeIndex = total ? currentIndex % total : 0;
  const item = slides[safeIndex];

  useEffect(() => {
    if (total < 2 || isPaused) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const timer = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % total);
    }, INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [isPaused, total]);

  if (!item) return null;

  const goTo = (index: number) => {
    setCurrentIndex((index + total) % total);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured interviews"
      className="relative mt-8 w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 transition-all duration-500"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <div className="grid grid-cols-1 items-center gap-8 p-6 md:p-10 lg:grid-cols-12">
        <Link
          href={`/news/${item.slug}`}
          className="group relative block aspect-[4/3] overflow-hidden rounded-xl shadow-lg lg:col-span-7"
        >
          <SafeArticleImage
            key={item.id}
            src={item.cover_image_url}
            alt={item.cover_image_alt}
            fill
            priority={safeIndex === 0}
            loading={safeIndex === 0 ? undefined : "lazy"}
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </Link>

        <div className="flex flex-col justify-between space-y-4 lg:col-span-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#c41e3a]">
            FEATURED INTERVIEW • {safeIndex + 1} OF {total}
          </p>
          <h2 className="font-serif text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            <Link
              href={`/news/${item.slug}`}
              className="transition hover:text-[#c41e3a]"
            >
              {item.title}
            </Link>
          </h2>
          <p className="line-clamp-3 text-sm text-muted-foreground sm:text-base">
            {item.excerpt}
          </p>
          <p className="text-xs font-medium text-muted-foreground">
            By{" "}
            <span className="font-semibold text-neutral-800">{item.authorName}</span>
            <span className="mx-1.5">·</span>
            {formatPublishedAt(item.published_at)}
          </p>
          <div>
            <Link
              href={`/news/${item.slug}`}
              className="inline-flex items-center rounded bg-[#c41e3a] px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:opacity-90"
            >
              Read Full Story →
            </Link>
          </div>
        </div>
      </div>

      {total > 1 ? (
        <div className="flex justify-end px-6 pb-6 md:px-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-2 py-1.5">
            <button
              type="button"
              aria-label="Previous interview"
              className="px-2 text-sm font-semibold text-neutral-700 hover:text-[#c41e3a]"
              onClick={() => goTo(safeIndex - 1)}
            >
              ←
            </button>
            <div className="flex items-center gap-1.5 px-1" role="tablist" aria-label="Slides">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  role="tab"
                  aria-label={`Show interview ${index + 1}`}
                  aria-selected={index === safeIndex}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    index === safeIndex
                      ? "w-6 bg-[#c41e3a]"
                      : "w-1.5 bg-neutral-300 hover:bg-neutral-400",
                  )}
                  onClick={() => goTo(index)}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Next interview"
              className="px-2 text-sm font-semibold text-neutral-700 hover:text-[#c41e3a]"
              onClick={() => goTo(safeIndex + 1)}
            >
              →
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
