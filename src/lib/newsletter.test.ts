import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NEWSLETTER_DISMISS_DAYS,
  NEWSLETTER_DELAY_MS,
  dismissedAtForArticle,
  normalizeNewsletterEmail,
  rememberArticleDismiss,
  shouldShowNewsletterPrompt,
} from "./newsletter.ts";

describe("normalizeNewsletterEmail", () => {
  it("accepts a work email and lowercases it", () => {
    assert.equal(normalizeNewsletterEmail("  Editor@TradeFlock.com "), "editor@tradeflock.com");
  });

  it("rejects empty, malformed, and oversized values", () => {
    assert.equal(normalizeNewsletterEmail(""), null);
    assert.equal(normalizeNewsletterEmail("not-an-email"), null);
    assert.equal(normalizeNewsletterEmail(12), null);
    assert.equal(normalizeNewsletterEmail(`${"a".repeat(250)}@x.com`), null);
  });
});

describe("shouldShowNewsletterPrompt", () => {
  const now = Date.parse("2026-09-21T12:00:00.000Z");

  it("shows when there is no subscribe or dismiss record", () => {
    assert.equal(
      shouldShowNewsletterPrompt({ now, subscribed: null, dismissedAt: null }),
      true,
    );
  });

  it("hides after a successful subscribe", () => {
    assert.equal(
      shouldShowNewsletterPrompt({ now, subscribed: "1", dismissedAt: null }),
      false,
    );
  });

  it("hides for seven days after dismiss, then returns", () => {
    const sixDaysAgo = String(now - 6 * 24 * 60 * 60 * 1000);
    const eightDaysAgo = String(now - 8 * 24 * 60 * 60 * 1000);
    assert.equal(
      shouldShowNewsletterPrompt({ now, subscribed: null, dismissedAt: sixDaysAgo }),
      false,
    );
    assert.equal(
      shouldShowNewsletterPrompt({ now, subscribed: null, dismissedAt: eightDaysAgo }),
      true,
    );
    assert.equal(NEWSLETTER_DISMISS_DAYS, 7);
  });

  it("opens on a new article even if another story was dismissed", () => {
    const stored = rememberArticleDismiss(null, "first-story", now);
    assert.equal(
      shouldShowNewsletterPrompt({
        now,
        subscribed: null,
        dismissedAt: dismissedAtForArticle(stored, "second-story"),
      }),
      true,
    );
    assert.equal(
      shouldShowNewsletterPrompt({
        now,
        subscribed: null,
        dismissedAt: dismissedAtForArticle(stored, "first-story"),
      }),
      false,
    );
  });

  it("waits ten seconds before opening", () => {
    assert.equal(NEWSLETTER_DELAY_MS, 10_000);
  });
});
