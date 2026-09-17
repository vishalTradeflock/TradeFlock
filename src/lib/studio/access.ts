import { isModerator, type StudioRole } from "@/lib/studio/roles";
import { roleCanWriteGlobalHeadCode } from "@/lib/public-head";

export function canEditArticle(role: StudioRole, userId: string, authorId: string) {
  if (isModerator(role)) return true;
  return authorId === userId;
}

export function canDeleteArticle(role: StudioRole) {
  return isModerator(role);
}

export function canPublishArticle(role: StudioRole) {
  return isModerator(role);
}

export function canInviteStaff(role: StudioRole) {
  return isModerator(role);
}

export function canManageSiteSettings(role: StudioRole) {
  return isModerator(role);
}

/** Global head code executes on every public page. Masthead/admin only. */
export function canWriteGlobalHeadCode(role: StudioRole | null | undefined) {
  return roleCanWriteGlobalHeadCode(role);
}

export function canAssignAnyAuthor(role: StudioRole) {
  return isModerator(role);
}
