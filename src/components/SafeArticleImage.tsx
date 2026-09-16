"use client";

import Image, { type ImageProps } from "next/image";
import { Newspaper } from "lucide-react";
import { useEffect, useState, type SyntheticEvent } from "react";
import {
  FALLBACK_COVER_IMAGE,
  PLACEHOLDER_COVER,
  resolveCoverImage,
} from "@/lib/images";
import { cn } from "@/lib/utils";

type SafeArticleImageProps = Omit<ImageProps, "src" | "alt"> & {
  src: string | null | undefined;
  alt: string;
  fallbackSrc?: string;
};

function skipOptimizer(url: string) {
  try {
    const host = new URL(url).hostname;
    // Unsplash is in next.config remotePatterns; other https covers (Supabase, source/OG) use native img.
    if (host === "images.unsplash.com" || host === "plus.unsplash.com") return false;
    return true;
  } catch {
    return true;
  }
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

function CoverPlaceholder() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-neutral-100"
      aria-hidden
    >
      <Newspaper className="h-5 w-5 text-neutral-400" strokeWidth={1.5} />
    </div>
  );
}

function nextFallback(current: string) {
  if (current !== FALLBACK_COVER_IMAGE && current !== PLACEHOLDER_COVER) {
    return FALLBACK_COVER_IMAGE;
  }
  if (current !== PLACEHOLDER_COVER) {
    return PLACEHOLDER_COVER;
  }
  return null;
}

export default function SafeArticleImage({
  src,
  alt,
  className,
  priority,
  loading,
  unoptimized,
  onError,
  fill,
  sizes,
  fallbackSrc,
  ...props
}: SafeArticleImageProps) {
  const resolved = resolveCoverImage(src);
  const initial = isUsableSrc(resolved) ? resolved : fallbackSrc || PLACEHOLDER_COVER;
  const [currentSrc, setCurrentSrc] = useState(initial);
  const [failed, setFailed] = useState(false);
  const useNativeImg = unoptimized ?? skipOptimizer(currentSrc);

  useEffect(() => {
    const next = isUsableSrc(resolved) ? resolved : fallbackSrc || PLACEHOLDER_COVER;
    setCurrentSrc(next);
    setFailed(false);
  }, [resolved, fallbackSrc]);

  const handleError = (event: SyntheticEvent<HTMLImageElement, Event>) => {
    const target = event.currentTarget;
    target.onerror = null;
    onError?.(event);
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      return;
    }
    const fallback = nextFallback(currentSrc);
    if (fallback) {
      setCurrentSrc(fallback);
      return;
    }
    setFailed(true);
  };

  if (failed) {
    return <CoverPlaceholder />;
  }

  if (useNativeImg) {
    return (
      // Native img so 404s always fire onError (Next/Image can swallow optimizer failures).
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={currentSrc}
        alt={alt}
        className={cn(
          fill ? "absolute inset-0 h-full w-full object-cover" : "object-cover",
          className,
        )}
        onError={handleError}
      />
    );
  }

  return (
    <Image
      {...props}
      src={currentSrc}
      alt={alt}
      fill={fill}
      sizes={sizes}
      className={cn("object-cover", className)}
      onError={handleError}
      priority={priority}
      loading={priority ? undefined : loading ?? "lazy"}
      unoptimized={unoptimized}
    />
  );
}
