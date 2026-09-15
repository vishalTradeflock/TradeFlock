"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ArticleWithRelations } from "@/lib/types";

/** Constant reading pace: one copy of the strip crosses in width / this many px per second. */
const PX_PER_SECOND = 48;

export function BreakingTicker({ articles }: { articles: ArticleWithRelations[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(55);
  const loop = articles.length ? [...articles, ...articles] : [];

  useEffect(() => {
    const node = trackRef.current;
    if (!node || articles.length === 0) return;

    const measure = () => {
      const loopWidth = node.scrollWidth / 2;
      if (loopWidth <= 0) return;
      setDuration(loopWidth / PX_PER_SECOND);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [articles]);

  if (articles.length === 0) return null;

  return (
    <div className="group relative min-w-0 flex-1 overflow-hidden">
      <div
        ref={trackRef}
        className="ticker-track gap-10 text-[12px] leading-5 text-neutral-100 hover:[animation-play-state:paused] group-hover:[animation-play-state:paused]"
        style={{ animationDuration: `${duration}s` }}
      >
        {loop.map((article, index) => (
          <Link
            key={`${article.id}-${index}`}
            href={`/news/${article.slug}`}
            className="shrink-0 whitespace-nowrap hover:text-white"
          >
            <span className="mr-2 font-semibold uppercase tracking-wider text-[#ff6b81]">
              {article.category.name}
            </span>
            {article.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
