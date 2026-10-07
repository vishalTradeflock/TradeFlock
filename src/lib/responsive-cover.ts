/**
 * Build a short srcset from hosts that already resize.
 * Unsplash, CNBC, and TechCrunch keep their other query params.
 * Supabase public objects use image transformation.
 * Wikimedia Commons originals use the standard thumb widths.
 * Hosts that do not resize, including PR Newswire, are returned unchanged
 * so the stored URL is what the browser requests.
 */

/** Social cards want about this wide. Wikimedia snaps it to an allowed thumb. */
export const OG_COVER_WIDTH = 1200;

const WIKIMEDIA_WIDTHS = [20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840] as const;

const SUPABASE_OBJECT_PREFIX = "/storage/v1/object/public/";
const SUPABASE_RENDER_PREFIX = "/storage/v1/render/image/public/";

type Variant = { width: number; href: string };

/**
 * www.tradeflock.us/wp-content/... redirects to the apex and then to
 * www.tradeflockusa.com with the same path. A live uploads file matched
 * byte-for-byte when requested directly from www.tradeflockusa.com, so the
 * browser can skip that chain. Any other host or path is left alone.
 */
export function canonicalCoverSrc(src: string): string {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }
  if (url.protocol !== "https:") return src;
  if (url.hostname !== "www.tradeflock.us") return src;
  if (!url.pathname.startsWith("/wp-content/")) return src;
  return new URL(`${url.pathname}${url.search}${url.hash}`, "https://www.tradeflockusa.com").href;
}

/**
 * One resized URL at `width` (or the nearest smaller Wikimedia thumb).
 * Null when this host cannot shrink, or the file is already that small.
 */
export function resizedCoverUrl(src: string, width: number): string | null {
  if (!Number.isFinite(width) || width <= 0) return null;
  const normalized = canonicalCoverSrc(src);
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return null;
  }
  const [variant] = variantsFor(url, [width]);
  if (!variant || variant.href === url.href) return null;
  return variant.href;
}

/** Cover URL to put behind the og:image proxy: a ~1200w variant when the host can make one. */
export function ogImageSource(src: string): string {
  return resizedCoverUrl(src, OG_COVER_WIDTH) ?? canonicalCoverSrc(src);
}

export function coverSrcSet(
  src: string,
  widths: readonly number[],
  displayWidth?: number,
): { src: string; srcSet?: string } {
  const normalized = canonicalCoverSrc(src);
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return { src: normalized };
  }

  const wanted = [...new Set(widths.filter((width) => Number.isFinite(width) && width > 0))].sort(
    (a, b) => a - b,
  );
  if (!wanted.length) return { src: normalized };

  const variants = variantsFor(url, wanted);
  if (variants.length < 2) return { src: normalized };

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

function variantsFor(url: URL, widths: number[]): Variant[] {
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
  if (host.endsWith(".supabase.co") && host !== "supabase.co") {
    return supabaseVariants(url, widths);
  }
  if (host === "upload.wikimedia.org") {
    return wikimediaVariants(url, widths);
  }
  return [];
}

function sizedParams(
  url: URL,
  widths: number[],
  widthKey: string,
  heightKey: string,
): Variant[] {
  const currentW = positive(url.searchParams.get(widthKey));
  const currentH = positive(url.searchParams.get(heightKey));
  const variants: Variant[] = [];

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

function techCrunchResize(url: URL, widths: number[]): Variant[] {
  const resize = url.searchParams.get("resize");
  if (!resize) return [];
  const [rawW, rawH] = resize.split(",");
  const currentW = positive(rawW);
  const currentH = positive(rawH);
  if (!currentW) return [];

  const variants: Variant[] = [];
  for (const width of widths) {
    if (width > currentW) continue;
    const copy = new URL(url.href);
    const height = currentH ? Math.max(1, Math.round((currentH * width) / currentW)) : 0;
    copy.searchParams.set("resize", height ? `${width},${height}` : String(width));
    variants.push({ width, href: copy.href });
  }
  return variants;
}

/**
 * Width-only variants use contain so the whole frame scales down.
 * A render URL that already crops with width and height keeps that mode
 * and scales both axes. Cover without a height stretches the frame, so it
 * is not used for a srcset.
 */
function supabaseVariants(url: URL, widths: number[]): Variant[] {
  const isObject = url.pathname.startsWith(SUPABASE_OBJECT_PREFIX);
  const isRender = url.pathname.startsWith(SUPABASE_RENDER_PREFIX);
  if (!isObject && !isRender) return [];
  const rest = url.pathname.slice((isObject ? SUPABASE_OBJECT_PREFIX : SUPABASE_RENDER_PREFIX).length);
  const slash = rest.indexOf("/");
  if (slash <= 0 || slash >= rest.length - 1) return [];

  const currentW = isRender ? positive(url.searchParams.get("width")) : 0;
  const currentH = isRender ? positive(url.searchParams.get("height")) : 0;
  const cropped = Boolean(currentW && currentH);
  const requestedMode = url.searchParams.get("resize");
  const mode = cropped
    ? requestedMode === "contain" || requestedMode === "fill" || requestedMode === "cover"
      ? requestedMode
      : "cover"
    : "contain";

  const variants: Variant[] = [];
  for (const width of widths) {
    if (currentW && width > currentW) continue;
    const copy = new URL(`${url.origin}${SUPABASE_RENDER_PREFIX}${rest}`);
    if (isRender) {
      url.searchParams.forEach((value, key) => {
        if (key === "width" || key === "height" || key === "quality" || key === "resize") return;
        copy.searchParams.append(key, value);
      });
    }
    copy.searchParams.set("width", String(width));
    if (cropped) {
      copy.searchParams.set(
        "height",
        String(Math.max(1, Math.round((currentH * width) / currentW))),
      );
    }
    copy.searchParams.set("quality", "75");
    copy.searchParams.set("resize", mode);
    variants.push({ width, href: copy.href });
  }
  return variants;
}

function wikimediaVariants(url: URL, widths: number[]): Variant[] {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "wikipedia" || parts[1] !== "commons") return [];

  let hashA: string;
  let hashAb: string;
  let file: string;
  let knownWidth = 0;
  if (parts[2] === "thumb") {
    if (parts.length !== 7) return [];
    hashA = parts[3] ?? "";
    hashAb = parts[4] ?? "";
    file = parts[5] ?? "";
    const named = /^(\d+)px-/.exec(parts[6] ?? "");
    knownWidth = positive(named?.[1] ?? null);
    if (!knownWidth) return [];
  } else if (parts.length === 5) {
    hashA = parts[2] ?? "";
    hashAb = parts[3] ?? "";
    file = parts[4] ?? "";
  } else {
    return [];
  }
  if (!hashA || !hashAb || !file) return [];

  let decoded: string;
  try {
    decoded = decodeURIComponent(file);
  } catch {
    return [];
  }
  if (!decoded || decoded.includes("/") || decoded.includes("\\")) return [];
  const suffix = wikimediaThumbSuffix(decoded);
  if (suffix === null) return [];

  const seen = new Set<number>();
  const variants: Variant[] = [];
  for (const width of widths) {
    const snapped = snapWikimediaWidth(width, knownWidth);
    if (!snapped || seen.has(snapped)) continue;
    seen.add(snapped);
    const thumb = `${snapped}px-${file}${suffix}`;
    variants.push({
      width: snapped,
      href: `${url.origin}/wikipedia/commons/thumb/${hashA}/${hashAb}/${file}/${thumb}`,
    });
  }
  return variants;
}

/** SVG and TIFF thumbs are PNG. Other convertible types are skipped. */
function wikimediaThumbSuffix(decodedName: string): string | null {
  const lower = decodedName.toLowerCase();
  if (lower.endsWith(".svg") || lower.endsWith(".svgz")) return ".png";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return ".png";
  if (/\.(?:jpe?g|png|gif|webp)$/.test(lower)) return "";
  return null;
}

/** Nearest allowed Commons width at or below `width`, and never above a known original. */
function snapWikimediaWidth(width: number, knownWidth: number): number {
  const limit = knownWidth > 0 ? Math.min(width, knownWidth) : width;
  let snapped = 0;
  for (const allowed of WIKIMEDIA_WIDTHS) {
    if (allowed <= limit) snapped = allowed;
    else break;
  }
  return snapped;
}

function positive(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
