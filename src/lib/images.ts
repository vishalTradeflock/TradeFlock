export const FALLBACK_COVER_IMAGE =
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80";

const ALLOWED_HOSTS = new Set([
  "images.unsplash.com",
  "plus.unsplash.com",
  "www.tradeflockusa.com",
  "tradeflockusa.com",
]);

export const EDITORIAL_COVERS = [
  // Tech / AI
  "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1518773553398-650c184e0bb3?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=1200&q=80",
  // Markets / Trading
  "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1200&q=80",
  // Finance / Banking
  "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1565514020176-b31d2542ed3e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1526304640173-94cb2232017e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
  // Leadership
  "https://images.unsplash.com/photo-1521737711867-e3b973223fbd?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=1200&q=80",
] as const;

type CoverSource = {
  id: string;
  title: string;
  cover_image_url?: string | null;
};

function hashKey(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function resolveCoverImage(url: string | null | undefined): string {
  if (!url) return FALLBACK_COVER_IMAGE;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return FALLBACK_COVER_IMAGE;
    if (parsed.hostname.endsWith("supabase.co")) return url;
    if (ALLOWED_HOSTS.has(parsed.hostname)) return url;
    return FALLBACK_COVER_IMAGE;
  } catch {
    return FALLBACK_COVER_IMAGE;
  }
}

export function pickEditorialCover(article: CoverSource, offset = 0) {
  const index =
    (article.title.length + hashKey(article.id) + offset) % EDITORIAL_COVERS.length;
  return EDITORIAL_COVERS[index];
}

function isWeakCover(url: string | null | undefined) {
  return !url?.trim();
}

export function assignDistinctCovers<T extends CoverSource>(articles: T[]): T[] {
  const used = new Set<string>();
  let previous = "";

  return articles.map((article, index) => {
    const raw = article.cover_image_url?.trim() ?? "";
    let url = !raw || isWeakCover(raw) ? pickEditorialCover(article, index) : resolveCoverImage(raw);

    if (used.has(url) || url === previous) {
      for (let step = 1; step <= EDITORIAL_COVERS.length; step += 1) {
        const candidate = pickEditorialCover(article, index + step);
        if (!used.has(candidate) && candidate !== previous) {
          url = candidate;
          break;
        }
      }
    }

    used.add(url);
    previous = url;
    return { ...article, cover_image_url: url };
  });
}
