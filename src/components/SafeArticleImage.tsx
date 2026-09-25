"use client";

import Image, { type ImageProps } from "next/image";
import { useState, type SyntheticEvent } from "react";
import { resolveCoverImage, shouldBypassImageOptimizer } from "@/lib/images";
import { cn } from "@/lib/utils";

type SafeArticleImageProps = Omit<ImageProps, "src" | "alt"> & {
  src: string | null | undefined;
  alt: string;
  /** Desk / category shown on the neutral card when the story has no usable cover. */
  label?: string | null;
};

/**
 * Neutral branded card for a story without a usable cover. Deliberately not a
 * photo: a shared stand-in photo would put the same image on many stories.
 */
export function CoverPlaceholder({ label }: { label?: string | null }) {
  const text = label?.trim();
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 overflow-hidden bg-gradient-to-br from-neutral-900 via-neutral-800 to-[#3a0d16] px-3 text-center"
      aria-hidden
    >
      <span className="h-0.5 w-8 bg-[#c41e3a]" />
      <span className="font-serif text-[11px] font-semibold tracking-wide text-white/90 sm:text-sm">
        TradeFlock
      </span>
      {text ? (
        <span className="line-clamp-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/60 sm:text-[10px]">
          {text}
        </span>
      ) : null}
    </div>
  );
}

type Stage = "optimized" | "native" | "failed";

function initialStage(src: string | null, unoptimized?: boolean): Stage {
  if (!src) return "failed";
  if (unoptimized || shouldBypassImageOptimizer(src)) return "native";
  return "optimized";
}

/**
 * Renders a story's own cover. If the image optimizer fails (e.g. Vercel
 * returns 402 when the optimization quota is exhausted) it retries the same
 * URL as a plain <img>; if that fails too it shows the neutral card. It never
 * swaps in a different stock photo, so two stories can't end up sharing one.
 */
export default function SafeArticleImage({
  src,
  alt,
  label,
  className,
  priority,
  loading,
  unoptimized,
  onError,
  fill,
  sizes,
  ...props
}: SafeArticleImageProps) {
  const resolved = resolveCoverImage(src);
  const sourceKey = `${resolved ?? ""}\0${unoptimized ? 1 : 0}`;
  const [stage, setStage] = useState<Stage>(() => initialStage(resolved, unoptimized));
  const [seenKey, setSeenKey] = useState(sourceKey);

  if (seenKey !== sourceKey) {
    setSeenKey(sourceKey);
    setStage(initialStage(resolved, unoptimized));
  }

  const advance = () => setStage((current) => (current === "optimized" ? "native" : "failed"));

  const handleError = (event: SyntheticEvent<HTMLImageElement, Event>) => {
    onError?.(event);
    advance();
  };

  // An image that already failed before hydration never fires onError in React.
  const catchEarlyFailure = (element: HTMLImageElement | null) => {
    if (element && element.complete && element.naturalWidth === 0 && element.currentSrc) {
      advance();
    }
  };

  if (!resolved || stage === "failed") {
    return <CoverPlaceholder label={label} />;
  }

  if (stage === "native") {
    return (
      // Native img so 404s always fire onError (Next/Image can swallow optimizer failures).
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key="native"
        ref={catchEarlyFailure}
        src={resolved}
        alt={alt}
        loading={priority ? "eager" : loading ?? "lazy"}
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
      key="optimized"
      ref={catchEarlyFailure}
      src={resolved}
      alt={alt}
      fill={fill}
      sizes={sizes}
      className={cn("object-cover", className)}
      onError={handleError}
      priority={priority}
      loading={priority ? undefined : loading ?? "lazy"}
    />
  );
}
