"use client";

import Image, { type ImageProps } from "next/image";
import { Newspaper } from "lucide-react";
import { useState, type SyntheticEvent } from "react";
import {
  FALLBACK_COVER_IMAGE,
  resolveCoverImage,
  shouldBypassImageOptimizer,
} from "@/lib/images";
import { cn } from "@/lib/utils";

type SafeArticleImageProps = Omit<ImageProps, "src" | "alt"> & {
  src: string | null | undefined;
  alt: string;
  fallbackSrc?: string;
};

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

function pickInitialSrc(resolved: string, fallbackSrc?: string) {
  if (isUsableSrc(resolved)) return resolved;
  if (fallbackSrc && isUsableSrc(fallbackSrc)) return fallbackSrc;
  return FALLBACK_COVER_IMAGE;
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
  const sourceKey = `${resolved}\0${fallbackSrc ?? ""}`;
  const [currentSrc, setCurrentSrc] = useState(() => pickInitialSrc(resolved, fallbackSrc));
  const [failed, setFailed] = useState(false);
  const [seenKey, setSeenKey] = useState(sourceKey);

  if (seenKey !== sourceKey) {
    setSeenKey(sourceKey);
    setCurrentSrc(pickInitialSrc(resolved, fallbackSrc));
    setFailed(false);
  }

  const useNativeImg = unoptimized ?? shouldBypassImageOptimizer(currentSrc);

  const handleError = (event: SyntheticEvent<HTMLImageElement, Event>) => {
    const target = event.currentTarget;
    target.onerror = null;
    onError?.(event);

    if (fallbackSrc && isUsableSrc(fallbackSrc) && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      return;
    }
    if (currentSrc !== FALLBACK_COVER_IMAGE) {
      setCurrentSrc(FALLBACK_COVER_IMAGE);
      return;
    }
    setFailed(true);
  };

  if (failed || !isUsableSrc(currentSrc)) {
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
