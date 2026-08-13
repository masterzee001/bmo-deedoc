import type { AuthUserProfile } from "@pics-nigeria/shared";

/**
 * One session, one place.
 *
 * The app stored four separate tokens — member, admin, agent, candidate — and
 * pages picked whichever they knew about, taking the first that existed. Sign-out
 * removed only the key belonging to the page you happened to be on, so a stale
 * token from another role survived and the next page drove with the wrong
 * session. The resulting 403s read as data faults rather than as the wrong user.
 *
 * The canonical key is written on every sign-in. The legacy keys are written
 * alongside it so the many pages that still read them directly keep working, and
 * every one of them is cleared on sign-out. Reads fall back through the legacy
 * keys so a session created before this change is not silently dropped.
 */

const CANONICAL_KEY = "picsNigeriaSession";

/** Every key the app has ever written a token to. */
const LEGACY_KEYS = [
  "picsNigeriaAdminToken",
  "picsNigeriaToken",
  "picsNigeriaAgentToken",
  "picsNigeriaCandidateToken",
] as const;

export function saveSession(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CANONICAL_KEY, token);
  // Written until every page reads through this module. Until then a single
  // canonical key would simply sign everyone out.
  for (const key of LEGACY_KEYS) {
    window.localStorage.setItem(key, token);
  }
}

export function readSession(): string | null {
  if (typeof window === "undefined") return null;
  const canonical = window.localStorage.getItem(CANONICAL_KEY);
  if (canonical) return canonical;
  for (const key of LEGACY_KEYS) {
    const legacy = window.localStorage.getItem(key);
    if (legacy) return legacy;
  }
  return null;
}

/** Clears every key, so signing out actually signs out. */
export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CANONICAL_KEY);
  for (const key of LEGACY_KEYS) {
    window.localStorage.removeItem(key);
  }
}

/**
 * Where each role belongs after signing in.
 *
 * Command roles land on the command dashboard rather than the legacy overview:
 * STATE_OFFICER and COORDINATOR are first-class there, and previously landed on
 * /platform — a page with no navigation and a single sign-out button, despite
 * both being first-class on the command screens.
 */
export function homeForRole(role: AuthUserProfile["role"]): string {
  switch (role) {
    case "SUPER_ADMIN":
    case "STATE_OFFICER":
    case "COORDINATOR":
      return "/admin/command";
    case "ADMIN":
      return "/admin/dashboard";
    case "VALIDATOR":
    case "PAYOUT_OFFICER":
      return "/admin/pre-election";
    case "AGENT":
      return "/agent/dashboard";
    case "MEMBER":
    case "VOTER":
      return "/dashboard";
    default:
      return "/dashboard";
  }
}

/**
 * Roles that may still sign in.
 *
 * CANDIDATE is absent deliberately. In the Ogun model a candidate is a record
 * the organisation maintains, not an operator: the candidate schema takes a name
 * as a string, with no email and no password, and the phase-1 migration maps a
 * legacy CANDIDATE user to a candidate domain record rather than to a role.
 */
export const SIGN_IN_ROLES: AuthUserProfile["role"][] = [
  "SUPER_ADMIN",
  "STATE_OFFICER",
  "COORDINATOR",
  "VALIDATOR",
  "PAYOUT_OFFICER",
  "MEMBER",
  "ADMIN",
  "AGENT",
  "VOTER",
];

export function canSignIn(role: AuthUserProfile["role"]) {
  return SIGN_IN_ROLES.includes(role);
}
