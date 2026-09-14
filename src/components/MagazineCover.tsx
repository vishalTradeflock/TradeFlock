"use client";

import { useEffect, useRef, useState } from "react";
import { renderPdfPageToDataUrl } from "@/lib/pdfjs-browser";
import { cn } from "@/lib/utils";

type MagazineCoverProps = {
  pdfUrl: string;
  title: string;
  className?: string;
};

const coverCache = new Map<string, string>();

function EditorialFallback({ title, className }: { title: string; className?: string }) {
  return (
    <div
      className={cn(
        "relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-md border border-neutral-700 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-950 p-6 shadow-md",
        className,
      )}
    >
      <span
        className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/40 to-transparent"
        aria-hidden
      />
      <div>
        <p className="font-serif text-sm font-bold tracking-[0.18em] text-white">
          TRADEFLOCK
        </p>
        <span className="mt-2 block h-px w-12 bg-[#d4af37]" aria-hidden />
      </div>
      <h3 className="line-clamp-4 font-serif text-base font-semibold leading-tight text-white md:text-lg">
        {title}
      </h3>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#d4af37]">
        Digital Edition
      </span>
    </div>
  );
}

function CoverShimmer() {
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded bg-neutral-200 shadow-md">
      <div className="magazine-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent" />
    </div>
  );
}

export default function MagazineCover({ pdfUrl, title, className }: MagazineCoverProps) {
  const [src, setSrc] = useState(() => coverCache.get(pdfUrl) ?? "");
  const [failed, setFailed] = useState(!pdfUrl);
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pdfUrl) {
      setFailed(true);
      return;
    }
    const cached = coverCache.get(pdfUrl);
    if (cached) {
      setSrc(cached);
      setFailed(false);
      return;
    }

    const node = nodeRef.current;
    if (!node) return;

    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void renderPdfPageToDataUrl(pdfUrl, 1, 640)
          .then(({ dataUrl }) => {
            if (cancelled) return;
            coverCache.set(pdfUrl, dataUrl);
            setSrc(dataUrl);
            setFailed(false);
          })
          .catch(() => {
            if (!cancelled) setFailed(true);
          });
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [pdfUrl]);

  if (failed) {
    return <EditorialFallback title={title} className={className} />;
  }

  if (!src) {
    return (
      <div ref={nodeRef} className={className}>
        <CoverShimmer />
      </div>
    );
  }

  return (
    <div
      ref={nodeRef}
      className={cn("relative aspect-[3/4] overflow-hidden rounded shadow-md", className)}
    >
      {/* Native img: PDF page 1 rasterized by pdf.js */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={title} className="h-full w-full object-cover" />
    </div>
  );
}
