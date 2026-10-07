/**
 * Newsroom API roles. Each role has its own bearer token in an env var; the
 * values are never logged. Permissions (approved revision 1):
 *   desk_*        : claim signals, submit reporting packets
 *   features      : same as a desk, for ESCALATE_TO_FEATURES work
 *   signal_desk   : write/triage signals, assign claims (Chief of Staff triage)
 *   wire_editor   : read everything, write verdicts. Only role that can.
 *   publisher     : publish an article that already has a PUBLISH verdict
 */
export const NEWSROOM_ROLES = {
  desk_macro: "NEWSROOM_TOKEN_DESK_MACRO",
  desk_markets: "NEWSROOM_TOKEN_DESK_MARKETS",
  desk_ma: "NEWSROOM_TOKEN_DESK_MA",
  desk_strategy: "NEWSROOM_TOKEN_DESK_STRATEGY",
  desk_tech: "NEWSROOM_TOKEN_DESK_TECH",
  desk_retail: "NEWSROOM_TOKEN_DESK_RETAIL",
  features: "NEWSROOM_TOKEN_FEATURES",
  signal_desk: "NEWSROOM_TOKEN_SIGNAL_DESK",
  wire_editor: "NEWSROOM_TOKEN_WIRE_EDITOR",
  publisher: "NEWSROOM_TOKEN_PUBLISHER",
} as const;

export type NewsroomRole = keyof typeof NEWSROOM_ROLES;
export type Permission = "read" | "signal_write" | "claim" | "packet" | "verdict" | "publish";

const PERMISSIONS: Record<NewsroomRole, Permission[]> = {
  desk_macro: ["read", "claim", "packet"],
  desk_markets: ["read", "claim", "packet"],
  desk_ma: ["read", "claim", "packet"],
  desk_strategy: ["read", "claim", "packet"],
  desk_tech: ["read", "claim", "packet"],
  desk_retail: ["read", "claim", "packet"],
  features: ["read", "claim", "packet"],
  signal_desk: ["read", "signal_write", "claim"],
  wire_editor: ["read", "verdict"],
  publisher: ["read", "publish"],
};

export function can(role: NewsroomRole, permission: Permission): boolean {
  return PERMISSIONS[role].includes(permission);
}

/** Desk a role files for; signal_desk may assign any desk. */
export function deskForRole(role: NewsroomRole): string | null {
  if (role.startsWith("desk_")) return role.slice(5);
  if (role === "features") return "features";
  return null;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function roleForToken(
  authorization: string | null,
  env: Record<string, string | undefined> = process.env,
): NewsroomRole | null {
  const match = authorization?.match(/^Bearer\s+(\S+)$/);
  if (!match) return null;
  const token = match[1];
  if (token.length < 32) return null;
  let found: NewsroomRole | null = null;
  for (const [role, envName] of Object.entries(NEWSROOM_ROLES) as [NewsroomRole, string][]) {
    const expected = env[envName];
    if (expected && expected.length >= 32 && safeEqual(token, expected)) found = role;
  }
  return found;
}
