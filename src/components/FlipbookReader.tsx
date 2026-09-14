"use client";

import React, { useEffect, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import * as pdfjsLib from "pdfjs-dist";
import { installPdfJsBlobWorker } from "@/lib/pdfjs-worker";

if (typeof window !== "undefined") {
  installPdfJsBlobWorker(pdfjsLib);
}

type FlipBookHandle = {
  pageFlip: () => {
    flipPrev: () => void;
    flipNext: () => void;
  };
};

interface FlipbookReaderProps {
  pdfUrl: string;
}

const FlipPage = React.forwardRef<HTMLDivElement, { src: string; label: string }>(
  function FlipPage({ src, label }, ref) {
    return (
      <div ref={ref} className="h-full w-full overflow-hidden bg-white">
        {/* Native img: pre-rasterized PDF page */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} className="block h-full w-full object-fill" />
      </div>
    );
  },
);

export default function FlipbookReader({ pdfUrl }: FlipbookReaderProps) {
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [bookSize, setBookSize] = useState({ width: 550, height: 750 });
  const bookRef = useRef<FlipBookHandle | null>(null);

  useEffect(() => {
    function updateSize() {
      const availH = window.innerHeight - 110;
      const availW = window.innerWidth - 60;
      let h = availH;
      let w = h * 0.707;

      if (w * 2 > availW) {
        w = availW / 2;
        h = w / 0.707;
      }
      setBookSize({ width: Math.floor(w), height: Math.floor(h) });
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    let active = true;

    async function renderPDF() {
      if (!pdfUrl) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setPages([]);
        setCurrentPage(0);
        const proxiedUrl = `${window.location.origin}/api/pdf-proxy?url=${encodeURIComponent(pdfUrl)}`;
        const loadingTask = pdfjsLib.getDocument({
          url: proxiedUrl,
          withCredentials: false,
        });
        const doc = await loadingTask.promise;
        const pageImages: string[] = [];

        for (let i = 1; i <= doc.numPages; i += 1) {
          if (!active) {
            await doc.cleanup();
            await loadingTask.destroy();
            return;
          }
          setProgress(`Page ${i} of ${doc.numPages}`);
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d", { alpha: false });
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvas, canvasContext: ctx, viewport }).promise;
            pageImages.push(canvas.toDataURL("image/jpeg", 0.85));
          }
        }

        await doc.cleanup();
        await loadingTask.destroy();
        if (active) {
          setPages(pageImages);
          setLoading(false);
        }
      } catch (err) {
        console.error("Flipbook load error:", err);
        if (active) setLoading(false);
      }
    }

    void renderPDF();
    return () => {
      active = false;
    };
  }, [pdfUrl]);

  const onFlip = (e: { data: number }) => {
    setCurrentPage(e.data);
  };

  if (loading || pages.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#121212] text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#c41e3a] border-t-transparent" />
        <p className="text-xs uppercase tracking-widest text-neutral-400">
          Loading Magazine Edition…
        </p>
        {progress ? (
          <p className="font-mono text-[11px] text-neutral-500">{progress}</p>
        ) : null}
      </div>
    );
  }

  const isCover = currentPage === 0;

  return (
    <div className="relative flex h-full w-full select-none flex-col items-center justify-center overflow-hidden bg-[#121212]">
      <div
        className="transition-transform duration-300 ease-out"
        style={{
          transform: isCover ? `translateX(-${bookSize.width / 2}px)` : "translateX(0)",
        }}
      >
        {/* react-pageflip ships incomplete TypeScript props */}
        {/* @ts-expect-error HTMLFlipBook ref and size props are untyped */}
        <HTMLFlipBook
          ref={bookRef}
          className="shadow-2xl"
          width={bookSize.width}
          height={bookSize.height}
          size="fixed"
          minWidth={bookSize.width}
          maxWidth={bookSize.width}
          minHeight={bookSize.height}
          maxHeight={bookSize.height}
          showCover
          drawShadow
          maxShadowOpacity={0.5}
          onFlip={onFlip}
        >
          {pages.map((imgSrc, index) => (
            <FlipPage key={index} src={imgSrc} label={`Page ${index + 1}`} />
          ))}
        </HTMLFlipBook>
      </div>

      <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full border border-neutral-700/70 bg-neutral-900/90 px-5 py-2 text-xs text-neutral-300 shadow-2xl backdrop-blur">
        <button
          type="button"
          onClick={() => bookRef.current?.pageFlip()?.flipPrev()}
          disabled={currentPage === 0}
          className="px-1 font-bold transition hover:text-white disabled:opacity-30"
        >
          ◀
        </button>
        <span className="font-mono text-[11px] text-neutral-400">
          {currentPage === 0
            ? "Cover"
            : `${currentPage} - ${Math.min(currentPage + 1, pages.length)}`}{" "}
          / {pages.length}
        </span>
        <button
          type="button"
          onClick={() => bookRef.current?.pageFlip()?.flipNext()}
          disabled={currentPage >= pages.length - 1}
          className="px-1 font-bold transition hover:text-white disabled:opacity-30"
        >
          ▶
        </button>
        <div className="mx-1 h-3.5 w-px bg-neutral-700" />
        <button
          type="button"
          onClick={() => {
            if (!document.fullscreenElement) {
              void document.documentElement.requestFullscreen();
            } else {
              void document.exitFullscreen();
            }
          }}
          className="transition hover:text-white"
          title="Fullscreen"
        >
          ⛶
        </button>
      </div>
    </div>
  );
}
