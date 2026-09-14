"use client";

import dynamic from "next/dynamic";

const FlipbookReader = dynamic(() => import("@/components/FlipbookReader"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-[16/10] max-h-[85vh] w-full items-center justify-center overflow-hidden rounded-xl bg-neutral-950 p-4 shadow-2xl">
      <p className="text-sm text-neutral-400">Opening edition…</p>
    </div>
  ),
});

export default FlipbookReader;
