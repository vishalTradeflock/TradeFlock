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

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
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
      window.setTimeout(() => handleDismiss(false), 2200);
    } catch (error: unknown) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-500 sm:p-6",
        isVisible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={() => handleDismiss()}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative z-10 w-full max-w-3xl rounded-2xl border border-border/80 bg-background p-6 shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:p-8",
          isVisible
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-[100vh] scale-95 opacity-0",
        )}
      >
        <button
          type="button"
          onClick={() => handleDismiss()}
          className="absolute top-4 right-4 cursor-pointer rounded-full p-1.5 text-muted-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close newsletter popup"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col gap-6 pr-6 md:flex-row md:items-center md:justify-between md:pr-4">
          <div className="max-w-md space-y-1.5">
            <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              TradeFlock Dispatch
            </span>
            <h3
              id={titleId}
              className="font-serif text-xl leading-snug font-bold tracking-tight text-foreground sm:text-2xl"
            >
              Independent executive intelligence.
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Curated briefings on tech, markets, and enterprise leadership delivered
              directly to your inbox weekly.
            </p>
          </div>

          <div className="w-full shrink-0 md:w-80">
            {status === "success" ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-700">
                <Check className="h-4 w-4" />
                <span>You&apos;re in. Welcome to TradeFlock.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your email"
                    autoComplete="email"
                    className="flex-1 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-xs text-foreground transition placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-foreground focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className={cn(
                      "flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-foreground px-4 py-2.5 text-xs font-semibold text-background transition hover:opacity-90 disabled:opacity-50",
                    )}
                  >
                    {status === "loading" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    <span>Subscribe</span>
                  </button>
                </div>

                {status === "error" ? (
                  <p className="pl-1 text-[10px] font-medium text-[#c41e3a]">{errorMessage}</p>
                ) : null}

                <p className="pl-1 text-[10px] text-muted-foreground/70">
                  Weekly dispatch. No spam, unsubscribe anytime.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
