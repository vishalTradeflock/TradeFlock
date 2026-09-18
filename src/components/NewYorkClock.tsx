"use client";

import { useEffect, useState } from "react";

export function NewYorkClock() {
  const [mounted, setMounted] = useState(false);
  const [timeStr, setTimeStr] = useState({ hours: "", minutes: "", ampm: "" });
  const [showColon, setShowColon] = useState(true);

  useEffect(() => {
    setMounted(true);

    const updateClock = () => {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      const parts = formatter.formatToParts(now);
      const hours = parts.find((p) => p.type === "hour")?.value || "";
      const minutes = parts.find((p) => p.type === "minute")?.value || "";
      const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value?.toUpperCase() || "";

      setTimeStr({ hours, minutes, ampm: dayPeriod });
      setShowColon((prev) => !prev);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return <span className="tabular-nums opacity-0">12:00 PM EDT</span>;
  }

  return (
    <span className="inline-flex items-center font-medium tabular-nums tracking-normal text-neutral-600">
      <span>{timeStr.hours}</span>
      <span
        style={{ opacity: showColon ? 1 : 0 }}
        className="mx-[1.5px] select-none font-bold transition-opacity duration-150"
      >
        :
      </span>
      <span>{timeStr.minutes}</span>
      <span className="ml-1 text-[10px] tracking-wider">
        {timeStr.ampm} EDT
      </span>
    </span>
  );
}
