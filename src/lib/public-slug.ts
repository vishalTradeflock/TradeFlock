/**
 * Request-time guards for dynamic public routes.
 * Scanner paths (`wp-login.php`, `.env`, `xmlrpc.php`) 404 before Supabase.
 * Legacy article redirects keep trailing and repeated hyphens.
 */

/** New public slugs stop at 80 characters. Legacy redirects run longer. */
export const ROUTABLE_SLUG_MAX = 160;

/** Current stories and old redirect slugs. Dots and other junk fail. */
const ROUTABLE_ARTICLE_SLUG = /^[a-z0-9]+(?:-+[a-z0-9]+)*-*$/;

/** Magazine issues. Same shape the sitemap already accepts. */
const ROUTABLE_MAGAZINE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

export function isRoutableArticleSlug(slug: string): boolean {
  if (!slug || slug.length > ROUTABLE_SLUG_MAX) return false;
  return ROUTABLE_ARTICLE_SLUG.test(slug.toLowerCase());
}

export function isRoutableMagazineSlug(slug: string): boolean {
  const clean = slug.trim();
  if (!clean || clean.length > ROUTABLE_SLUG_MAX) return false;
  return ROUTABLE_MAGAZINE_SLUG.test(clean);
}
