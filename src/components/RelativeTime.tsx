"use client";

import { useEffect, useState } from "react";
import { formatShortDate, formatTimeAgo } from "@/lib/utils";

/**
 * Server HTML uses the calendar date so a regeneration does not rewrite the
 * page just because "5m ago" became "7m ago". The relative label is applied
 * after mount.
 */
export function RelativeTime({ iso }: { iso: string }) {
  const stable = formatShortDate(iso);
  const [label, setLabel] = useState(stable);

  useEffect(() => {
    const update = () => setLabel(formatTimeAgo(iso));
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, [iso]);

  return <time dateTime={iso}>{label}</time>;
}
