import { isModerator, type StudioRole } from "@/lib/studio/roles";

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
