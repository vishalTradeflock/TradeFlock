"use client";

import { useEffect, useMemo, useState } from "react";
import { magazineEmbedSrc, parseFlipbookHash, parseFlipbookPage } from "@/lib/magazine-links";
import type { Magazine } from "@/lib/types";

export function MagazineFlipbookFrame({ magazine }: { magazine: Magazine }) {
  const [page, setPage] = useState<number | null>(null);

  useEffect(() => {
    function readLocation() {
      const query = new URLSearchParams(window.location.search).get("page") ?? undefined;
      setPage(parseFlipbookHash(window.location.hash) ?? parseFlipbookPage(query));
    }
    readLocation();
    window.addEventListener("hashchange", readLocation);
    window.addEventListener("popstate", readLocation);
    return () => {
      window.removeEventListener("hashchange", readLocation);
      window.removeEventListener("popstate", readLocation);
    };
  }, []);

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
