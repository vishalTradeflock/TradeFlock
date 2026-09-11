"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SafeArticleImage from "@/components/SafeArticleImage";
import type { ArticleWithRelations } from "@/lib/types";
import { formatPublishedAt } from "@/lib/utils";

const INTERVAL_MS = 2000;

export default function HeroCarousel({
  articles,
}: {
  articles: ArticleWithRelations[];
}) {
  const slides = articles.slice(0, 8);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const safeIndex = slides.length ? index % slides.length : 0;

  useEffect(() => {
    if (slides.length < 2 || paused) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  const article = slides[safeIndex] ?? slides[0];
  if (!article) return null;

  return (
    <article
      className="group"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <Link href={`/news/${article.slug}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden rounded bg-neutral-100">
          <SafeArticleImage
            src={article.cover_image_url}
            alt={article.cover_image_alt}
            fill
            priority={safeIndex === 0}
            loading={safeIndex === 0 ? undefined : "lazy"}
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover transition-opacity group-hover:opacity-90"
          />
        </div>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c41e3a]">
          {article.category.name}
        </p>
        <h2 className="mt-1 font-serif text-2xl font-bold leading-tight tracking-tight text-neutral-950 hover:underline sm:text-3xl">
          {article.title}
        </h2>
        {article.dek || article.excerpt ? (
          <p className="mt-2 line-clamp-2 text-muted-foreground">
            {article.dek || article.excerpt}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-neutral-500">
          By <span className="font-semibold text-neutral-800">{article.author.name}</span>
          <span className="mx-1.5">·</span>
          {formatPublishedAt(article.published_at)}
        </p>
      </Link>
    </article>
  );
}
