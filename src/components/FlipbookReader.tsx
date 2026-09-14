"use client";

import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Volume2,
  VolumeX,
} from "lucide-react";
import HTMLFlipBook from "react-pageflip";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPdfPageCount, renderPdfPageToDataUrl } from "@/lib/pdfjs-browser";

const ZOOM_LEVELS = [1, 1.25, 1.5] as const;
const FLIP_SOUND_SRC =
  "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3";

type FlipApi = {
  flipNext: () => void;
  flipPrev: () => void;
  getCurrentPageIndex: () => number;
  getPageCount: () => number;
  turnToPage: (page: number) => void;
};

type FlipBookHandle = {
  pageFlip: () => FlipApi;
};

type FlipbookReaderProps = {
  pdfUrl: string;
};

export default function FlipbookReader({ pdfUrl }: FlipbookReaderProps) {
  const bookRef = useRef<FlipBookHandle>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(false);
  const imagesRef = useRef<Record<number, string>>({});
  const inflightRef = useRef(new Set<number>());
  const [pageImages, setPageImages] = useState<Record<number, string>>({});
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [pageSize, setPageSize] = useState({ width: 420, height: 560 });

  mutedRef.current = muted;
  const zoom = ZOOM_LEVELS[zoomIndex];

  const loadPage = useCallback(
    async (pageNumber: number, count: number) => {
      if (!pdfUrl || pageNumber < 1 || pageNumber > count) return;
      if (imagesRef.current[pageNumber] || inflightRef.current.has(pageNumber)) return;
      inflightRef.current.add(pageNumber);
      try {
        const { dataUrl } = await renderPdfPageToDataUrl(pdfUrl, pageNumber, 900);
        imagesRef.current = { ...imagesRef.current, [pageNumber]: dataUrl };
        setPageImages(imagesRef.current);
      } catch {
        /* leave placeholder */
      } finally {
        inflightRef.current.delete(pageNumber);
      }
    },
    [pdfUrl],
  );

  const loadAround = useCallback(
    (zeroIndex: number, count: number) => {
      const pdfPage = zeroIndex + 1;
      void Promise.all([
        loadPage(pdfPage - 1, count),
        loadPage(pdfPage, count),
        loadPage(pdfPage + 1, count),
        loadPage(pdfPage + 2, count),
      ]);
    },
    [loadPage],
  );

  useEffect(() => {
    const audio = new Audio(FLIP_SOUND_SRC);
    audio.preload = "auto";
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

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
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const measure = () => {
      const maxHeight = Math.max(280, window.innerHeight - 150);
      const maxWidth = Math.max(240, window.innerWidth - 32);
      if (window.matchMedia("(max-width: 767px)").matches) {
        const width = Math.min(maxWidth, maxHeight * 0.75);
        setPageSize({ width, height: width / 0.75 });
        return;
      }
      const width = Math.min(maxWidth / 2, maxHeight * 0.75);
      setPageSize({ width, height: width / 0.75 });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (!pdfUrl) {
      setError("This edition does not have a PDF on file yet.");
      return;
    }
    let cancelled = false;
    imagesRef.current = {};
    setPageImages({});
    setCurrentPage(0);
    setError("");
    void getPdfPageCount(pdfUrl)
      .then((count) => {
        if (cancelled) return;
        setTotalPages(count);
        loadAround(0, count);
      })
      .catch(() => {
        if (!cancelled) setError("Unable to open this edition in the flipbook.");
      });
    return () => {
      cancelled = true;
    };
  }, [pdfUrl, loadAround]);

  const playFlipSound = useCallback(() => {
    if (mutedRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }, []);

  const flip = useCallback((direction: "next" | "prev") => {
    const api = bookRef.current?.pageFlip();
    if (!api) return;
    if (direction === "next") api.flipNext();
    else api.flipPrev();
  }, []);

  const goToPage = useCallback(
    (pageNumber: number) => {
      const api = bookRef.current?.pageFlip();
      if (!api || !totalPages) return;
      const index = Math.min(totalPages, Math.max(1, pageNumber)) - 1;
      api.turnToPage(index);
    },
    [totalPages],
  );

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void document.documentElement.requestFullscreen();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        flip("next");
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        flip("prev");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flip]);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col items-center justify-center overflow-hidden">
      {error ? (
        <p className="px-6 text-center text-sm text-neutral-300">{error}</p>
      ) : !totalPages ? (
        <p className="text-sm text-neutral-400">Opening edition…</p>
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
        >
          <HTMLFlipBook
            key={isMobile ? "portrait" : "landscape"}
            className="magazine-flipbook"
            style={{}}
            width={Math.round(pageSize.width)}
            height={Math.round(pageSize.height)}
            size="stretch"
            minWidth={240}
            maxWidth={Math.round(pageSize.width)}
            minHeight={320}
            maxHeight={Math.round(pageSize.height)}
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
              setCurrentPage(event.data);
              playFlipSound();
              loadAround(event.data, totalPages);
            }}
            ref={bookRef}
          >
            {Array.from({ length: totalPages }, (_, index) => {
              const src = pageImages[index + 1];
              return (
                <div
                  key={index}
                  className="magazine-flip-page"
                  data-density={index === 0 || index === totalPages - 1 ? "hard" : "soft"}
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={`Page ${index + 1}`} />
                  ) : (
                    <div className="relative h-full w-full bg-neutral-100">
                      <div className="magazine-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/80 to-transparent" />
                    </div>
                  )}
                </div>
              );
            })}
          </HTMLFlipBook>
        </div>
      )}

      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-neutral-700/60 bg-neutral-900/90 px-4 py-1.5 text-xs text-neutral-300 shadow-2xl backdrop-blur">
        <button
          type="button"
          aria-label="Previous page"
          className="rounded-full p-1 hover:bg-white/10 hover:text-white"
          onClick={() => flip("prev")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <label className="flex items-center gap-1 whitespace-nowrap">
          <span>Page</span>
          <input
            type="number"
            min={1}
            max={Math.max(1, totalPages)}
            value={currentPage + 1}
            onChange={(event) => goToPage(Number(event.target.value))}
            className="w-10 rounded border border-neutral-700 bg-black/40 px-1 py-0.5 text-center text-neutral-200 outline-none"
          />
          <span>/ {totalPages || "—"}</span>
        </label>
        <button
          type="button"
          aria-label="Zoom out"
          className="rounded-full p-1 hover:bg-white/10 hover:text-white disabled:opacity-30"
          disabled={zoomIndex === 0}
          onClick={() => setZoomIndex((index) => Math.max(0, index - 1))}
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          className="rounded-full p-1 hover:bg-white/10 hover:text-white disabled:opacity-30"
          disabled={zoomIndex === ZOOM_LEVELS.length - 1}
          onClick={() => setZoomIndex((index) => Math.min(ZOOM_LEVELS.length - 1, index + 1))}
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={muted ? "Unmute page-flip sound" : "Mute page-flip sound"}
          className="rounded-full p-1 hover:bg-white/10 hover:text-white"
          onClick={() => setMuted((value) => !value)}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <button
          type="button"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          className="rounded-full p-1 hover:bg-white/10 hover:text-white"
          onClick={toggleFullscreen}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <button
          type="button"
          aria-label="Next page"
          className="rounded-full p-1 hover:bg-white/10 hover:text-white"
          onClick={() => flip("next")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
