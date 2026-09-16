"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function IssueShareButton({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function shareIssue() {
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      /* fall through to copy */
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={() => void shareIssue()}
      className={cn(
        "inline-flex h-10 items-center border border-neutral-200 px-5 text-xs font-bold uppercase tracking-widest hover:text-[#c41e3a]",
        className,
      )}
    >
      {copied ? "Copied" : "Share"}
    </button>
  );
}
