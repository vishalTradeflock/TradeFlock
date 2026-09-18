"use client";

import { useEffect, useState } from "react";
import { NewYorkClock } from "@/components/NewYorkClock";
import { formatDateline, newYorkEdition } from "@/lib/utils";

type MastheadLine = {
  date: string;
  edition: string;
};

function readLine(): MastheadLine {
  const now = new Date();
  return {
    date: formatDateline(now),
    edition: newYorkEdition(now),
  };
}

export function MastheadDateline() {
  const [line, setLine] = useState<MastheadLine | null>(null);

  useEffect(() => {
    const tick = () => setLine(readLine());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <p suppressHydrationWarning>
      {line ? (
        <>
          {line.date}
          <span className="mx-2 text-neutral-300">|</span>
          <span className="inline-flex items-center gap-1.5">
            NEW YORK • <NewYorkClock />
          </span>
          <span className="mx-2 text-neutral-300">|</span>
          {line.edition}
        </>
      ) : (
        "\u00a0"
      )}
    </p>
  );
}
