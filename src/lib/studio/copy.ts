import { FALLBACK_COVER_IMAGE } from "@/lib/images";

export function slugifyTitle(title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `${base || "desk-note"}-${Date.now().toString(36)}`;
}

export function excerptFromHtml(html: string) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= 220) return text || "Draft from TradeFlock Studio.";
  return `${text.slice(0, 217).trim()}…`;
}

export function coverFromHtml(html: string) {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1]?.trim() || FALLBACK_COVER_IMAGE;
}

export function authorSlugFromEmail(email: string) {
  const local = email.split("@")[0] ?? "writer";
  const slug = local.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "writer";
}
