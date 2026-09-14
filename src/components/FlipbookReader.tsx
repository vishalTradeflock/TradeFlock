"use client";

import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import HTMLFlipBook from "react-pageflip";
import { useCallback, useEffect, useRef, useState } from "react";
import { renderPdfPages } from "@/lib/pdfjs-browser";
import { cn } from "@/lib/utils";

type FlipApi = {
  flipNext: () => void;
  flipPrev: () => void;
  getCurrentPageIndex: () => number;
  getPageCount: () => number;
};

type FlipBookHandle = {
  pageFlip: () => FlipApi;
};

type FlipbookReaderProps = {
  pdfUrl: string;
};

function playFlipSound() {
  try {
    const audio = new AudioContext();
    const buffer = audio.createBuffer(1, audio.sampleRate * 0.08, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.12;
    }
    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1400;
    source.buffer = buffer;
    source.connect(filter).connect(audio.destination);
    source.start();
    void audio.resume();
  } catch {
    /* autoplay / AudioContext may be blocked */
  }
}

export default function FlipbookReader({ pdfUrl }: FlipbookReaderProps) {
  const bookRef = useRef<FlipBookHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const onFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  useEffect(() => {
    if (!pdfUrl) {
      setError("This edition does not have a PDF on file yet.");
      return;
    }
    let cancelled = false;
    setPages([]);
    setError("");
    setPage(0);
    void renderPdfPages(pdfUrl, (current, total) => {
      if (!cancelled) setProgress({ current, total });
    })
      .then((images) => {
        if (!cancelled) setPages(images);
      })
      .catch(() => {
        if (!cancelled) setError("Unable to open this edition in the flipbook.");
      });
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  const flip = useCallback((direction: "next" | "prev") => {
    const api = bookRef.current?.pageFlip();
    if (!api) return;
    if (direction === "next") api.flipNext();
    else api.flipPrev();
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void stageRef.current?.requestFullscreen();
  }, []);

  const total = pages.length;
  const pageLabel = total ? `Page ${page + 1} of ${total}` : "Opening edition";

  return (
    <div
      ref={stageRef}
      className="flex aspect-[16/10] max-h-[85vh] w-full flex-col items-center justify-center overflow-hidden rounded-xl bg-neutral-950 p-4 shadow-2xl"
    >
      {error ? (
        <p className="px-6 text-center text-sm text-neutral-300">{error}</p>
      ) : !pages.length ? (
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-40 w-28 overflow-hidden rounded bg-neutral-800">
            <div className="magazine-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>
          <p className="text-sm text-neutral-400">
            {progress.total
              ? `Rendering pages ${progress.current} of ${progress.total}…`
              : "Loading flipbook…"}
          </p>
        </div>
      ) : (
        <>
          <div className="flex min-h-0 w-full flex-1 items-center justify-center">
            <HTMLFlipBook
              key={isMobile ? "portrait" : "landscape"}
              className="magazine-flipbook"
              style={{}}
              width={isMobile ? 340 : 420}
              height={isMobile ? 453 : 560}
              size="stretch"
              minWidth={280}
              maxWidth={980}
              minHeight={360}
              maxHeight={1200}
              startPage={0}
              drawShadow
              flippingTime={700}
              usePortrait={isMobile}
              startZIndex={0}
              autoSize
              maxShadowOpacity={0.65}
              showCover
              mobileScrollSupport
              clickEventForward
              useMouseEvents
              swipeDistance={30}
              showPageCorners
              disableFlipByClick={false}
              onFlip={(event: { data: number }) => {
                setPage(event.data);
                playFlipSound();
              }}
              ref={bookRef}
            >
              {pages.map((src, index) => (
                <div
                  key={`${src.slice(0, 24)}-${index}`}
                  className="magazine-flip-page"
                  data-density={index === 0 || index === pages.length - 1 ? "hard" : "soft"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Page ${index + 1}`} />
                </div>
              ))}
            </HTMLFlipBook>
          </div>
          <div className="mt-3 flex items-center justify-center gap-3 text-white">
            <button
              type="button"
              aria-label="Previous page"
              className="rounded border border-white/20 p-1.5 hover:bg-white/10"
              onClick={() => flip("prev")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="min-w-[8rem] text-center text-xs font-semibold tracking-wide text-neutral-200">
              {pageLabel}
            </p>
            <button
              type="button"
              aria-label="Next page"
              className="rounded border border-white/20 p-1.5 hover:bg-white/10"
              onClick={() => flip("next")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              className={cn(
                "rounded border border-white/20 p-1.5 hover:bg-white/10",
              )}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
