"use client";

import Image, { type ImageProps } from "next/image";
import { Newspaper } from "lucide-react";
import { useState } from "react";
import { resolveCoverImage } from "@/lib/images";
import { cn } from "@/lib/utils";

type SafeArticleImageProps = Omit<ImageProps, "src" | "alt"> & {
  src: string | null | undefined;
  alt: string;
};

export default function SafeArticleImage({
  src,
  alt,
  className,
  priority,
  loading,
  ...props
}: SafeArticleImageProps) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveCoverImage(src);

  if (failed) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-200 via-neutral-300 to-neutral-400"
        aria-hidden
      >
        <Newspaper className="h-5 w-5 text-neutral-600" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <Image
      src={resolved}
      alt={alt}
      className={cn("object-cover", className)}
      onError={() => setFailed(true)}
      priority={priority}
      loading={priority ? undefined : loading ?? "lazy"}
      {...props}
    />
  );
}
