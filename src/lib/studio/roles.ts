export const STUDIO_ROLES = ["writer", "moderator", "editor", "admin"] as const;

export type StudioRole = (typeof STUDIO_ROLES)[number];

export function normalizeStudioRole(role: string) {
  return role.trim().toLowerCase();
}

export function isStudioRole(role: string): role is StudioRole {
  return STUDIO_ROLES.includes(normalizeStudioRole(role) as StudioRole);
}

/** Desk, publish, and delete. `editor`/`admin` are treated as moderator until profiles are remapped. */
export function isModerator(role: StudioRole) {
  return role === "moderator" || role === "editor" || role === "admin";
}

export function isMasthead(role: StudioRole) {
  return isModerator(role);
}

export function studioHomePath(role: StudioRole) {
  return isModerator(role) ? "/studio" : "/studio/write";
}
