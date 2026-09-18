export function magazineDownloadPath(slug: string) {
  const clean = slug.trim().replace(/^\/+|\/+$/g, "");
  return `/api/magazine/${encodeURIComponent(clean)}/download`;
}

export function magazineDownloadFilename(title: string, slug = "edition") {
  const fromTitle = title.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const fromSlug = slug.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const stem = (fromTitle || fromSlug || "Edition").slice(0, 80);
  return `TradeFlock-Magazine-${stem}.pdf`;
}
