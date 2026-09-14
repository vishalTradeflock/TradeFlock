"use client";

import Image, { type ImageProps } from "next/image";
import { Newspaper } from "lucide-react";
import { useEffect, useState } from "react";
import { FALLBACK_COVER_IMAGE, resolveCoverImage } from "@/lib/images";
import { cn } from "@/lib/utils";

type SafeArticleImageProps = Omit<ImageProps, "src" | "alt"> & {
  src: string | null | undefined;
  alt: string;
};

function skipOptimizer(url: string) {
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

export default function SafeArticleImage({
  src,
  alt,
  className,
  priority,
  loading,
  unoptimized,
  onError,
  ...props
}: SafeArticleImageProps) {
  const resolved = resolveCoverImage(src);
  const [currentSrc, setCurrentSrc] = useState(resolved);
  const [failed, setFailed] = useState(!isUsableSrc(resolved));

  useEffect(() => {
    setCurrentSrc(resolved);
    setFailed(!isUsableSrc(resolved));
  }, [resolved]);

  if (failed) {
    return <CoverPlaceholder />;
  }

  return (
    <Image
      {...props}
      src={currentSrc}
      alt={alt}
      className={cn("object-cover", className)}
      onError={(event) => {
        onError?.(event);
        if (currentSrc !== FALLBACK_COVER_IMAGE) {
          setCurrentSrc(FALLBACK_COVER_IMAGE);
          return;
        }
        setFailed(true);
      }}
      priority={priority}
      loading={priority ? undefined : loading ?? "lazy"}
      unoptimized={unoptimized ?? skipOptimizer(currentSrc)}
    />
  );
}
