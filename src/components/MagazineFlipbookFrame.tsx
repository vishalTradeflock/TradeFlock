"use client";

import { useEffect, useMemo, useState } from "react";
import { magazineEmbedSrc, parseFlipbookHash } from "@/lib/magazine-links";
import type { Magazine } from "@/lib/types";

export function MagazineFlipbookFrame({
  magazine,
  queryPage,
}: {
  magazine: Magazine;
  queryPage: number;
}) {
  const [page, setPage] = useState<number | null>(null);

  useEffect(() => {
    function readLocation() {
      setPage(parseFlipbookHash(window.location.hash) ?? queryPage);
    }
    readLocation();
    window.addEventListener("hashchange", readLocation);
    return () => window.removeEventListener("hashchange", readLocation);
  }, [queryPage]);

  const src = useMemo(
    () => (page ? magazineEmbedSrc(magazine, page) : null),
    [magazine, page],
  );

  if (!src) {
    return (
      <p className="max-w-md px-6 text-center text-sm leading-6 text-neutral-400">
        {page
          ? "The digital flipbook for this edition is not available yet."
          : "Opening edition…"}
      </p>
    );
  }

  return (
    <iframe
      src={src}
      title={magazine.title}
      className="block h-full w-full border-0"
      allow="fullscreen"
    />
  );
}
