"use client";

import { useState } from "react";
import MagazineCard from "@/components/MagazineCard";
import type { Magazine } from "@/lib/types";

const PAGE_SIZE = 12;

export default function MagazineDeskGrid({ magazines }: { magazines: Magazine[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const shown = magazines.slice(0, visible);

  return (
    <>
      <div className="mt-8 grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((magazine) => (
          <MagazineCard key={magazine.id} magazine={magazine} />
        ))}
      </div>
      {visible < magazines.length ? (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            className="border border-neutral-200 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-neutral-700 hover:text-[#c41e3a]"
            onClick={() => setVisible((count) => count + PAGE_SIZE)}
          >
            Load More
          </button>
        </div>
      ) : null}
    </>
  );
}
