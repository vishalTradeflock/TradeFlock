/**
 * Global head code (`site_settings.global_head_code`) is raw HTML with site-wide
 * script execution. Writes must stay admin/masthead-only. This helper only
 * decides where it is *rendered*.
 */
export function shouldInjectGlobalHead(pathname: string | null | undefined) {
  const path = (pathname ?? "").split("?")[0] ?? "";
  if (path === "/studio" || path.startsWith("/studio/")) return false;
  if (path === "/api" || path.startsWith("/api/")) return false;
  return true;
}

export const GLOBAL_HEAD_CODE_MAX = 100_000;

export function roleCanWriteGlobalHeadCode(role: string | null | undefined) {
  return role === "moderator" || role === "editor" || role === "admin";
}

export function prepareGlobalHeadCode(raw: string) {
  if (raw.length > GLOBAL_HEAD_CODE_MAX) {
    return { ok: false as const, error: `Keep global head code under ${GLOBAL_HEAD_CODE_MAX} characters.` };
  }
  const trimmed = raw.trim();
  return { ok: true as const, value: trimmed || null };
}
