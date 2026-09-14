"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { enqueuePdfWork, renderPdfCoverThumbnail } from "@/lib/pdfjs-browser";
import { installPdfJsBlobWorker } from "@/lib/pdfjs-worker";
import { cn, formatShortDate } from "@/lib/utils";

if (typeof window !== "undefined") {
  installPdfJsBlobWorker(pdfjsLib);
}

type MagazineCoverProps = {
  pdfUrl: string;
  title: string;
  publishedAt?: string;
  coverImageUrl?: string | null;
  className?: string;
};

const coverCache = new Map<string, string>();

function usableCoverUrl(url?: string | null) {
  const trimmed = url?.trim() ?? "";
  if (!trimmed || /^(null|undefined|none|n\/a)$/i.test(trimmed)) return "";
  if (trimmed.startsWith("/covers/") && /\.(jpe?g|webp|png)$/i.test(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" ? trimmed : "";
  } catch {
    return "";
  }
}

function skipOptimizer(url: string) {
  if (url.startsWith("/")) return false;
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

function EditorialFallback({
  title,
  publishedAt,
  className,
}: {
  title: string;
  publishedAt?: string;
  className?: string;
}) {
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
      {publishedAt ? (
        <time
          dateTime={publishedAt}
          className="text-[10px] font-semibold uppercase tracking-widest text-[#d4af37]"
        >
          {formatShortDate(publishedAt)}
        </time>
      ) : (
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#d4af37]">
          Digital Edition
        </span>
      )}
    </div>
  );
}

export default function MagazineCover({
  pdfUrl,
  title,
  publishedAt,
  coverImageUrl,
  className,
}: MagazineCoverProps) {
  const storedCover = usableCoverUrl(coverImageUrl);
  const [src, setSrc] = useState(() => (pdfUrl ? coverCache.get(pdfUrl) ?? "" : ""));
  const [imageFailed, setImageFailed] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (storedCover) return;
    if (!pdfUrl) return;
    const cached = coverCache.get(pdfUrl);
    if (cached) {
      setSrc(cached);
      return;
    }

    const node = nodeRef.current;
    if (!node) return;

    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const proxiedUrl = `${window.location.origin}/api/pdf-proxy?url=${encodeURIComponent(pdfUrl)}`;
        void enqueuePdfWork(() => renderPdfCoverThumbnail(proxiedUrl))
          .then((dataUrl) => {
            if (cancelled) return;
            coverCache.set(pdfUrl, dataUrl);
            setSrc(dataUrl);
          })
          .catch(() => {
            /* Editorial card stays visible on CORS / range / PDF errors. */
          });
      },
      { rootMargin: "200px 0px", threshold: 0.1 },
    );
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [pdfUrl, storedCover]);

  if (storedCover && !imageFailed) {
    return (
      <div className={cn("relative aspect-[3/4] overflow-hidden rounded shadow-md", className)}>
        <Image
          src={storedCover}
          alt={title}
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
          loading="lazy"
          unoptimized={skipOptimizer(storedCover)}
          onError={() => setImageFailed(true)}
        />
      </div>
    );
  }

  if (src) {
    return (
      <div
        className={cn("relative aspect-[3/4] overflow-hidden rounded shadow-md", className)}
      >
        {/* Native img: PDF page 1 rasterized by pdf.js */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={title} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div ref={nodeRef} className={className}>
      <EditorialFallback title={title} publishedAt={publishedAt} />
    </div>
  );
}
