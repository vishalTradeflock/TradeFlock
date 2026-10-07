/**
 * Build a short srcset from hosts that already resize with a query param.
 * Every other parameter (Unsplash ixid, CNBC v, fit, crop, q) stays.
 * Hosts that do not resize, including PR Newswire, are returned unchanged
 * so the stored URL is what the browser requests.
 */
export function coverSrcSet(
  src: string,
  widths: readonly number[],
  displayWidth?: number,
): { src: string; srcSet?: string } {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return { src };
  }

  const wanted = [...new Set(widths.filter((width) => Number.isFinite(width) && width > 0))].sort(
    (a, b) => a - b,
  );
  if (!wanted.length) return { src };

  const variants = variantsFor(url, wanted);
  if (variants.length < 2) return { src };

  const target =
    displayWidth && displayWidth > 0
      ? displayWidth
      : variants[Math.floor((variants.length - 1) / 2)].width;
  const fallback = variants.reduce((best, item) =>
    Math.abs(item.width - target) < Math.abs(best.width - target) ? item : best,
  );

  return {
    src: fallback.href,
    srcSet: variants.map((item) => `${item.href} ${item.width}w`).join(", "),
  };
}

function variantsFor(url: URL, widths: number[]): { width: number; href: string }[] {
  const host = url.hostname;
  if (host === "images.unsplash.com" || host === "plus.unsplash.com") {
    return sizedParams(url, widths, "w", "h");
  }
  if (host === "image.cnbcfm.com") {
    return sizedParams(url, widths, "w", "h");
  }
  if (host === "techcrunch.com" || host === "www.techcrunch.com") {
    if (url.searchParams.has("resize")) return techCrunchResize(url, widths);
    if (url.searchParams.has("w")) return sizedParams(url, widths, "w", "h");
    return [];
  }
  return [];
}

function sizedParams(
  url: URL,
  widths: number[],
  widthKey: string,
  heightKey: string,
): { width: number; href: string }[] {
  const currentW = positive(url.searchParams.get(widthKey));
  const currentH = positive(url.searchParams.get(heightKey));
  const variants: { width: number; href: string }[] = [];

  for (const width of widths) {
    if (currentW && width > currentW) continue;
    const copy = new URL(url.href);
    copy.searchParams.set(widthKey, String(width));
    if (currentW && currentH) {
      copy.searchParams.set(heightKey, String(Math.max(1, Math.round((currentH * width) / currentW))));
    }
    variants.push({ width, href: copy.href });
  }

  return variants;
}

function techCrunchResize(url: URL, widths: number[]): { width: number; href: string }[] {
  const resize = url.searchParams.get("resize");
  if (!resize) return [];
  const [rawW, rawH] = resize.split(",");
  const currentW = positive(rawW);
  const currentH = positive(rawH);
  if (!currentW) return [];

  const variants: { width: number; href: string }[] = [];
  for (const width of widths) {
    if (width > currentW) continue;
    const copy = new URL(url.href);
    const height = currentH ? Math.max(1, Math.round((currentH * width) / currentW)) : 0;
    copy.searchParams.set("resize", height ? `${width},${height}` : String(width));
    variants.push({ width, href: copy.href });
  }
  return variants;
}

function positive(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
