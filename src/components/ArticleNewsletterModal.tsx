"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { Check, Loader2, X } from "lucide-react";
import {
  NEWSLETTER_DELAY_MS,
  NEWSLETTER_DISMISSED_KEY,
  NEWSLETTER_SUBSCRIBED_KEY,
  dismissedAtForArticle,
  normalizeNewsletterEmail,
  rememberArticleDismiss,
  shouldShowNewsletterPrompt,
} from "@/lib/newsletter";
import { cn } from "@/lib/utils";

const EXIT_MS = 500;

type ArticleNewsletterModalProps = {
  articleSlug: string;
};

export default function ArticleNewsletterModal({ articleSlug }: ArticleNewsletterModalProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleDismiss = useCallback(
    (persist = true) => {
      setIsVisible(false);
      if (persist && !window.localStorage.getItem(NEWSLETTER_SUBSCRIBED_KEY)) {
        const next = rememberArticleDismiss(
          window.localStorage.getItem(NEWSLETTER_DISMISSED_KEY),
          articleSlug,
          Date.now(),
        );
        window.localStorage.setItem(NEWSLETTER_DISMISSED_KEY, next);
      }
      window.setTimeout(() => setMounted(false), EXIT_MS);
    },
    [articleSlug],
  );

  useEffect(() => {
    setMounted(false);
    setIsVisible(false);
    setStatus("idle");
    setErrorMessage("");

    const subscribed = window.localStorage.getItem(NEWSLETTER_SUBSCRIBED_KEY);
    const dismissedAt = dismissedAtForArticle(
      window.localStorage.getItem(NEWSLETTER_DISMISSED_KEY),
      articleSlug,
    );
    if (
      !shouldShowNewsletterPrompt({
        now: Date.now(),
        subscribed,
        dismissedAt,
      })
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      setMounted(true);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setIsVisible(true));
      });
    }, NEWSLETTER_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [articleSlug]);

  useEffect(() => {
    if (!mounted || !isVisible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDismiss, isVisible, mounted]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeNewsletterEmail(email);
    if (!normalized) {
      setStatus("error");
      setErrorMessage("Enter a valid email address.");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });

      if (!res.ok) {
        const data: unknown = await res.json().catch(() => null);
        const message =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : "Failed to subscribe";
        throw new Error(message);
      }

      setStatus("success");
      window.localStorage.setItem(NEWSLETTER_SUBSCRIBED_KEY, "1");
      window.setTimeout(() => handleDismiss(false), 2500);
    } catch (error: unknown) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  if (!mounted) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2">
      <div
        role="complementary"
        aria-labelledby={titleId}
        className={cn(
          "relative flex flex-col gap-4 rounded-2xl border border-border/80 bg-background/95 p-4 shadow-2xl backdrop-blur-md transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:p-5 sm:px-7 md:flex-row md:items-center md:justify-between md:gap-8",
          isVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-[150%] opacity-0",
        )}
      >
        <button
          type="button"
          onClick={() => handleDismiss()}
          className="absolute top-3.5 right-3.5 cursor-pointer rounded-full p-1.5 text-muted-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close newsletter banner"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="pr-6 md:pr-0">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            TradeFlock Dispatch
          </span>
          <h3
            id={titleId}
            className="font-serif text-base leading-snug font-bold tracking-tight text-foreground sm:text-lg"
          >
            Independent executive intelligence.
          </h3>
          <p className="mt-0.5 line-clamp-1 max-w-md text-xs text-muted-foreground sm:line-clamp-none">
            Weekly reporting on tech, markets, and enterprise strategy directly to your
            inbox.
          </p>
        </div>

        <div className="w-full shrink-0 md:w-auto">
          {status === "success" ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-700">
              <Check className="h-4 w-4" />
              <span>You&apos;re subscribed. Welcome aboard.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
              <div className="flex w-full items-center gap-2 md:w-80">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your work email"
                  autoComplete="email"
                  className="flex-1 rounded-lg border border-border bg-muted/40 px-3.5 py-2 text-xs text-foreground transition placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-foreground focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90 disabled:opacity-50",
                  )}
                >
                  {status === "loading" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : null}
                  <span>Join</span>
                </button>
              </div>

              {status === "error" ? (
                <p className="pl-1 text-[10px] font-medium text-[#c41e3a]">{errorMessage}</p>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
