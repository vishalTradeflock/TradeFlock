export function usableHttpUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim() ?? "";
  if (!trimmed || /^(null|undefined|none|n\/a|#)$/i.test(trimmed)) return null;
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return trimmed;
  } catch {
    /* ignore */
  }
  return null;
}

function isLocalReaderUrl(url: string, slug: string) {
  return url.includes(`/magazine/${slug}/read`);
}

export function issueFlipbookHref(magazine: { slug: string }): string {
  return `/magazine/${magazine.slug}/read`;
}

export function honoreeSpreadPage(
  honoree: { page?: number | null; magazine_page?: number | null },
  index: number,
) {
  return honoree.magazine_page || honoree.page || (index + 1) * 2 + 2;
}

export function honoreeSpreadHref(
  magazine: { slug: string },
  honoree: { page?: number | null; magazine_page?: number | null },
  index = 0,
): string {
  return `${issueFlipbookHref(magazine)}#page/${honoreeSpreadPage(honoree, index)}`;
}

export function parseFlipbookPage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function parseFlipbookHash(hash: string) {
  const match = hash.match(/page[/=](\d+)/i);
  const page = match ? Number.parseInt(match[1], 10) : Number.NaN;
  return Number.isFinite(page) && page > 0 ? page : null;
}

function withPageHash(url: string, page: number) {
  const base = url.split("#")[0];
  return `${base}#page/${page}`;
}

export function magazineEmbedSrc(
  magazine: { slug: string; flipbook_url?: string | null; pdf_url?: string | null },
  page: number,
) {
  const hosted = usableHttpUrl(magazine.flipbook_url);
  if (hosted && !isLocalReaderUrl(hosted, magazine.slug)) {
    return withPageHash(hosted, page);
  }
  const pdf = usableHttpUrl(magazine.pdf_url);
  if (pdf) {
    return `/dflip/viewer.html?pdf=${encodeURIComponent(pdf)}&page=${page}#page/${page}`;
  }
  return null;
}

export function magazineExternalHref(
  magazine: { slug: string; flipbook_url?: string | null; pdf_url?: string | null },
) {
  const hosted = usableHttpUrl(magazine.flipbook_url);
  if (hosted && !isLocalReaderUrl(hosted, magazine.slug)) return hosted;
  return usableHttpUrl(magazine.pdf_url);
}
