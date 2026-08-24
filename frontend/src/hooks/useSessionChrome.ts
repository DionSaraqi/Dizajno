"use client";

import { useAuthStore } from "@/store/useAuthStore";
import type { UserSummary } from "@/lib/api";

/**
 * `pending` covers both `idle` and `authenticating` — the window before
 * `bootstrap()`'s refresh call has settled. Surfaces must render a neutral
 * placeholder here, never the anonymous state: `AuthBootstrap` fires its
 * request on mount, so committing to "Sign in" during that window shows a
 * flash of the wrong chrome to every signed-in user on a hard load.
 */
export type SessionState = "pending" | "anonymous" | "authed";

export interface SessionChrome {
  state: SessionState;
  /** Non-null exactly when `state === "authed"`. */
  user: UserSummary | null;
  signOut: () => Promise<void>;
  /** Convenience flags — same information, fewer string comparisons at call sites. */
  isPending: boolean;
  isAuthed: boolean;
  isAnonymous: boolean;
  /** True when the user belongs to at least one supplier. */
  hasSupplier: boolean;
  isAdmin: boolean;
}

/**
 * Single source of truth for session-dependent chrome (account chip, sign-in
 * affordances, gated nav items). Collapses the four-state auth status into the
 * three states the UI actually branches on, so no surface re-derives it and
 * every one handles the bootstrap window identically.
 */
export function useSessionChrome(): SessionChrome {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  // `authenticated` without a user would be a torn state; treat it as pending
  // rather than rendering a chip with no identity to show.
  const state: SessionState =
    status === "authenticated" && user
      ? "authed"
      : status === "unauthenticated"
        ? "anonymous"
        : "pending";

  const authedUser = state === "authed" ? user : null;

  return {
    state,
    user: authedUser,
    signOut: logout,
    isPending: state === "pending",
    isAuthed: state === "authed",
    isAnonymous: state === "anonymous",
    hasSupplier: (authedUser?.supplierMemberships?.length ?? 0) > 0,
    isAdmin: authedUser?.roles.includes("Admin") ?? false,
  };
}
