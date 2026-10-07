/**
 * Width allowlists for next/image.
 *
 * Next 16 getWidths():
 * - fill + sizes with `vw` → allSizes ≥ deviceSizes[0] × smallest vw ratio
 * - fill + sizes with only px → every allSizes entry (avoid this)
 * - width/height and no sizes → 1x and 2x, snapped to allSizes
 *
 * Layouts that justify this set (max canvas 1240px):
 * - 64 / 128 — MiddleScroller 64×64 thumbs @1x/@2x
 * - 96 / 256 — article related 96×64 thumbs @1x/@2x (192 snaps to 256)
 * - 384 / 750 — RelatedArticles 280–340px cards @1x/@2x
 * - 640 / 750 / 828 — mobile 100vw and listing cards @2x
 * - 1080 / 1200 — homepage hero (~620 CSS px) and category featured @2x
 * - 1920 — article hero 850 CSS px @2x (~1700). 2048 and 3840 are unused.
 */
export const IMAGE_DEVICE_SIZES = [640, 750, 828, 1080, 1200, 1920] as const;
export const IMAGE_SIZES = [64, 96, 128, 256, 384] as const;

export const IMAGE_ALL_SIZES = [...IMAGE_SIZES, ...IMAGE_DEVICE_SIZES].sort(
  (a, b) => a - b,
);

/** MiddleScroller and other 64×64 rail thumbs. */
export const THUMB_64 = { width: 64, height: 64 } as const;

/** Article related rail: h-16 w-24. */
export const THUMB_96x64 = { width: 96, height: 64 } as const;

/** RelatedArticles cards: 280px on small screens, 340px from sm. */
export const RELATED_CARD = { width: 340, height: 191 } as const;

/** GrowthStrategies portrait: 64px default, 80px from sm. */
export const THUMB_80 = { width: 80, height: 80 } as const;

/**
 * Desk and Latest cards (~400px, 16:9). Intrinsic 1x/2x snaps to 384 and 828,
 * not the full device list through 1920.
 */
export const CARD_16x9 = { width: 384, height: 216 } as const;

/**
 * Half-column heroes. 600 snaps to 640 and 1200, so the srcset does not
 * include the 1920 article-hero slot.
 */
export const HERO_600 = { width: 600, height: 375 } as const;

/**
 * Slot widths inside the 1240px frame (`px-4`, so the content box is
 * `min(100vw - 2rem, 1240px)`). These are CSS sizes, not optimizer widths.
 * Source srcsets stay on a short list so a phone can take 384 and a desktop
 * card can take 828 without advertising 1920 for every card.
 */
export const LATEST_CARD_SIZES =
  "(max-width: 767px) calc(100vw - 2rem), calc((min(100vw - 2rem, 1240px) - 3rem) / 3)";
export const LATEST_CARD_WIDTHS = [384, 640, 828] as const;

export const SPOTLIGHT_CARD_SIZES =
  "(max-width: 639px) calc(100vw - 2rem), calc((min(100vw - 2rem, 1240px) - 3rem) / 3)";

export const CATEGORY_GRID_SIZES =
  "(max-width: 767px) calc(100vw - 2rem), (max-width: 1023px) calc((100vw - 4rem) / 2), calc((min(100vw - 2rem, 1240px) - 4rem) / 3)";
export const CATEGORY_GRID_WIDTHS = [384, 640, 828] as const;

export const HOME_HERO_SIZES =
  "(max-width: 1023px) calc(100vw - 2rem), calc(min(100vw - 2rem, 1240px) / 2 - 1.5rem)";
export const HOME_HERO_WIDTHS = [640, 828, 1200] as const;

export const DEEP_DIVE_SIZES =
  "(max-width: 639px) calc(100vw - 2rem), (max-width: 1023px) calc((100vw - 3.25rem) / 2), calc((min(100vw - 2rem, 1240px) / 2 - 2.75rem) / 2)";
export const DEEP_DIVE_WIDTHS = [384, 640, 828] as const;

export const CATEGORY_FEATURED_SIZES =
  "(max-width: 1023px) calc(100vw - 2rem), calc(min(100vw - 2rem, 1240px) * 7 / 12)";
export const CATEGORY_FEATURED_WIDTHS = [640, 828, 1200, 1600] as const;

export const INSIGHTS_HERO_SIZES = "(max-width: 1023px) calc(100vw - 4rem), 640px";
export const INSIGHTS_HERO_WIDTHS = [640, 828, 1200] as const;

export const THUMB_64_SIZES = "64px";
export const THUMB_64_WIDTHS = [64, 128] as const;

export const THUMB_96_SIZES = "96px";
export const THUMB_96_WIDTHS = [96, 192] as const;

export const RELATED_CARD_SIZES =
  "(max-width: 639px) min(17.5rem, calc(100vw - 2rem)), 21.25rem";
export const RELATED_CARD_WIDTHS = [384, 680] as const;

export const ARTICLE_HERO_SIZES =
  "(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 850px";
export const ARTICLE_HERO_WIDTHS = [828, 1200, 1600, 1920] as const;

export function candidateWidths(input: { sizes?: string; width?: number }): number[] {
  const allSizes = IMAGE_ALL_SIZES;
  const deviceSizes = IMAGE_DEVICE_SIZES;
  if (input.sizes) {
    const viewportWidthRe = /(^|\s)(1?\d?\d)vw/g;
    const percentSizes: number[] = [];
    for (let match = viewportWidthRe.exec(input.sizes); match; match = viewportWidthRe.exec(input.sizes)) {
      percentSizes.push(Number.parseInt(match[2], 10));
    }
    if (percentSizes.length) {
      const smallestRatio = Math.min(...percentSizes) * 0.01;
      return allSizes.filter((size) => size >= deviceSizes[0] * smallestRatio);
    }
    return [...allSizes];
  }
  if (typeof input.width === "number") {
    return [
      ...new Set(
        [input.width, input.width * 2].map(
          (width) => allSizes.find((size) => size >= width) ?? allSizes[allSizes.length - 1],
        ),
      ),
    ];
  }
  return [...deviceSizes];
}
