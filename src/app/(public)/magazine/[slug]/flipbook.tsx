"use client";

import dynamic from "next/dynamic";

const FlipbookReader = dynamic(() => import("@/components/FlipbookReader"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#1e1e1e]">
      <p className="text-sm text-neutral-400">Opening edition…</p>
    </div>
  ),
});

export default FlipbookReader;
