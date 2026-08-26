import { create } from "zustand";
import * as api from "@/lib/api";
import type { AuthResponse, UserSummary } from "@/lib/api";

type AuthStatus = "idle" | "authenticating" | "authenticated" | "unauthenticated";

interface AuthState {
  status: AuthStatus;
  accessToken: string | null;
  user: UserSummary | null;
  /**
   * The last sign-in/registration failure, kept as the thrown value rather than
   * a string so the auth screens can read its per-field validation map.
   */
  error: unknown;
  /**
   * Set when a mid-session refresh was rejected by the server. Distinct from
   * `status`: see the listener at the bottom of this file for why the status is
   * deliberately left alone.
   */
  sessionExpired: boolean;
}

interface AuthActions {
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName?: string | null
  ) => Promise<void>;
  logout: () => Promise<void>;
  dismissSessionExpiry: () => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  status: "idle",
  accessToken: null,
  user: null,
  error: null,
  sessionExpired: false,
};

function applyAuthResponse(set: (partial: Partial<AuthState>) => void, auth: AuthResponse): void {
  api.setAccessToken(auth.accessToken);
  set({
    status: "authenticated",
    accessToken: auth.accessToken,
    user: auth.user,
    error: null,
    sessionExpired: false,
  });
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  ...initialState,

  bootstrap: async () => {
    if (get().status === "authenticating") return;
    set({ status: "authenticating", error: null });
    try {
      const refreshed = await api.refresh();
      if (refreshed) {
        applyAuthResponse(set, refreshed);
        return;
      }
    } catch {
      // fall through to unauthenticated
    }
    api.setAccessToken(null);
    set({ status: "unauthenticated", accessToken: null, user: null });
  },

  login: async (email, password) => {
    set({ status: "authenticating", error: null });
    try {
      const auth = await api.login({ email, password });
      applyAuthResponse(set, auth);
    } catch (error) {
      api.setAccessToken(null);
      set({ status: "unauthenticated", accessToken: null, user: null, error });
      throw error;
    }
  },

  register: async (email, password, displayName) => {
    set({ status: "authenticating", error: null });
    try {
      const auth = await api.register({
        email,
        password,
        displayName: displayName ?? null,
        locale: "sq",
      });
      applyAuthResponse(set, auth);
    } catch (error) {
      api.setAccessToken(null);
      set({ status: "unauthenticated", accessToken: null, user: null, error });
      throw error;
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {
      // best effort — clear local state regardless
    }
    api.setAccessToken(null);
    set({
      status: "unauthenticated",
      accessToken: null,
      user: null,
      error: null,
      sessionExpired: false,
    });
  },

  dismissSessionExpiry: () => set({ sessionExpired: false }),
}));

// Keep the store in sync when the API client refreshes the session in the
// background (401 → refresh-cookie → retry). Without this the store would
// hold a stale access token and user snapshot after the silent rotation.
api.onTokenRefreshed((auth) => {
  useAuthStore.setState({
    status: "authenticated",
    accessToken: auth.accessToken,
    user: auth.user,
    error: null,
    sessionExpired: false,
  });
});

// The refresh cookie was rejected: the session is genuinely over. Fired once
// per expiry even when a dozen requests 401 together, because the refresh is
// single-flight.
//
// `status` is deliberately NOT flipped to "unauthenticated" here. Every guarded
// page redirects to /login on that transition, which on /projects/[id] would
// unmount the designer and take unsaved canvas work with it. Instead the flag
// raises a persistent banner offering to sign in, so the user chooses when to
// leave the page — the "continue without loss of data" requirement in
// WCAG 2.2.5. Signing out explicitly, or a guard on a fresh page load, still
// moves the status as before.
api.onSessionExpired(() => {
  api.setAccessToken(null);
  useAuthStore.setState({ accessToken: null, sessionExpired: true });
});

export const useAuthStatus = (): AuthStatus => useAuthStore((s) => s.status);
export const useAuthUser = (): UserSummary | null => useAuthStore((s) => s.user);
export const useIsAuthenticated = (): boolean =>
  useAuthStore((s) => s.status === "authenticated");
