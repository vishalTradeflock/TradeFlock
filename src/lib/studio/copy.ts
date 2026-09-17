import { FALLBACK_COVER_IMAGE } from "@/lib/images";
import { slugFromTitle } from "@/lib/studio/slug";

export function slugifyTitle(title: string) {
  return slugFromTitle(title);
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

export function uniqueAuthorSlug(email: string, userId: string) {
  const base = authorSlugFromEmail(email);
  const suffix = userId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();
  return suffix ? `${base}-${suffix}` : `${base}-desk`;
}
