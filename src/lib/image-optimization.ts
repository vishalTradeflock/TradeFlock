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
