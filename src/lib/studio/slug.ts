export const SLUG_MAX = 80;

/** Final public article slug pattern. Single segment; no trailing hyphen. */
export const PUBLIC_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const CATEGORY_PATH_PREFIX =
  /^(?:\/)?(?:tech|technology|markets|leadership|finance|business|success-insights)\//i;

/**
 * Older bot slugify appended `Date.now().toString(36)` or a short hash,
 * often after a double hyphen when the title was truncated at SLUG_MAX.
 * Years like 2025 and uniqueness suffixes like -2 are not content keys.
 */
function isGeneratedContentKey(segment: string, force = false) {
  if (/^(?:19|20)\d{2}$/.test(segment)) return false;
  if (force && /^[a-z0-9]{4,10}$/.test(segment)) return true;
  if (!/^[a-z0-9]{6,10}$/.test(segment)) return false;
  if (!/[a-z]/.test(segment) || !/\d/.test(segment)) return false;
  return true;
}

export function stripGeneratedContentKey(slug: string, options?: { force?: boolean }) {
  const parts = slug.split("-").filter(Boolean);
  if (parts.length < 2) return slug;
  const last = parts[parts.length - 1];
  if (last && isGeneratedContentKey(last, options?.force === true)) {
    return parts.slice(0, -1).join("-");
  }
  return slug;
}

/** Normalize a slug or headline into a public article slug. Does not allocate uniqueness. */
export function sanitizeSlug(value: string) {
  const withoutCategory = value.trim().replace(CATEGORY_PATH_PREFIX, "");
  const lowered = withoutCategory.toLowerCase();
  const hadDoubleHyphen = /--[a-z0-9]+$/.test(lowered);
  const normalized = lowered
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const withoutKey = stripGeneratedContentKey(normalized, { force: hadDoubleHyphen });
  return withoutKey.slice(0, SLUG_MAX).replace(/-+$/g, "");
}

export function isValidPublicSlug(slug: string) {
  return slug.length > 0 && slug.length <= SLUG_MAX && PUBLIC_SLUG_PATTERN.test(slug);
}

export function slugFromTitle(title: string) {
  return sanitizeSlug(title) || "story";
}

/** Suggested replacement for an existing stored slug. Empty when nothing usable remains. */
export function proposeCleanSlug(current: string) {
  const cleaned = sanitizeSlug(current);
  return isValidPublicSlug(cleaned) ? cleaned : "";
}

export function needsSlugCleanup(current: string) {
  const proposed = proposeCleanSlug(current);
  return Boolean(proposed) && proposed !== current.trim();
}

export async function allocateArticleSlug(
  preferred: string | null | undefined,
  title: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = sanitizeSlug(preferred ?? "") || slugFromTitle(title);
  for (let n = 0; n < 80; n += 1) {
    const suffix = n === 0 ? "" : `-${n + 1}`;
    const candidate = `${base.slice(0, Math.max(1, SLUG_MAX - suffix.length))}${suffix}`;
    if (!isValidPublicSlug(candidate)) continue;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error("Could not allocate a unique public slug.");
}
