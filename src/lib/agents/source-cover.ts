import { isHttpsCoverUrl, publishCoverCandidates } from "@/lib/images";
import { pickUniqueCover, type PickedCover } from "@/lib/cover-picker";
import { isUnusableSourceImageUrl, ogImageFromHtml, shouldTrySourcePhoto } from "@/lib/source-photo";

const OG_TIMEOUT_MS = 4_000;
const SKIP_OG_HOSTS = /(^|\.)sec\.gov$/i;

/** Parse og:image / twitter:image from markup. Decodes `&amp;` before resolving. */
export { ogImageFromHtml };

/** Best-effort og:image from the source page. Never invents a URL; returns null on timeout/block. */
export async function fetchOgImageUrl(pageUrl: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(pageUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (SKIP_OG_HOSTS.test(parsed.hostname)) return null;

  try {
    const response = await fetch(pageUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(OG_TIMEOUT_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "TradeFlock USA newsroom@tradeflock-usa-nine.vercel.app",
      },
    });
    if (!response.ok) return null;
    const html = await response.text();
    const fromMeta = ogImageFromHtml(html, pageUrl);
    if (!fromMeta || !isHttpsCoverUrl(fromMeta) || isUnusableSourceImageUrl(fromMeta)) return null;
    return fromMeta;
  } catch {
    return null;
  }
}

/**
 * Cover for a newly published wire story, unique across all stories:
 * RSS/enclosure → og:image from the source page → Unsplash search with
 * story-specific terms (company / topic — never a person's name), skipping any photo another
 * story already uses. Logos — including PR Newswire `mma`/`mmx` logo assets,
 * filenames or alt text containing "logo", and very small or square brand marks —
 * site defaults, and legacy stock are rejected before that search.
 * Success Insights profiles skip the source photo and stay on the topic search.
 * Returns "" when nothing unused was found; the site then
 * renders the neutral branded card instead of a shared stock photo.
 */
export async function resolveUniquePublishCover(input: {
  imageUrl?: string | null;
  notesCoverUrl?: string | null;
  sourceUrl?: string | null;
  title: string;
  categorySlug?: string | null;
  used: Set<string>;
  /**
   * When the wire already downloaded this source page, pass its og:image
   * (or null) so publish does not fetch the page again.
   */
  prefetchedOgImageUrl?: string | null;
  ogAlreadyFetched?: boolean;
}): Promise<{ url: string; picked: PickedCover | null }> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY ?? null;
  const fromFeed = publishCoverCandidates({
    rssImageUrl: input.imageUrl,
    notesCoverUrl: input.notesCoverUrl,
  });
  const first = await pickUniqueCover({
    title: input.title,
    categorySlug: input.categorySlug,
    preferred: fromFeed,
    used: input.used,
    // Feed image first; only fetch og:image if the feed image is missing or already used.
    accessKey: null,
  });
  if (first) return { url: first.url, picked: first };

  const trySource = shouldTrySourcePhoto({ title: input.title, categorySlug: input.categorySlug });
  let og: string | null = null;
  if (input.ogAlreadyFetched) {
    og = input.prefetchedOgImageUrl ?? null;
  } else if (input.sourceUrl && trySource) {
    og = await fetchOgImageUrl(input.sourceUrl);
  }
  if (og && (!isHttpsCoverUrl(og) || isUnusableSourceImageUrl(og))) og = null;
  let picked: PickedCover | null = null;
  try {
    picked = await pickUniqueCover({
      title: input.title,
      categorySlug: input.categorySlug,
      preferred: publishCoverCandidates({ ogImageUrl: og }),
      used: input.used,
      accessKey,
    });
  } catch (err) {
    // Unsplash down / rate-limited must not block publishing.
    console.warn(`[cover] Unsplash unavailable: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!picked) {
    console.warn(`[cover] no unused cover for "${input.title}" — publishing with the neutral card`);
  }
  return { url: picked?.url ?? "", picked };
}
