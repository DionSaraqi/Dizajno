import { create } from "zustand";
import * as api from "@/lib/api";
import type { AuthResponse, UserSummary } from "@/lib/api";

type AuthStatus = "idle" | "authenticating" | "authenticated" | "unauthenticated";

interface AuthState {
  status: AuthStatus;
  accessToken: string | null;
  user: UserSummary | null;
  error: string | null;
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
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  status: "idle",
  accessToken: null,
  user: null,
  error: null,
};

function applyAuthResponse(set: (partial: Partial<AuthState>) => void, auth: AuthResponse): void {
  api.setAccessToken(auth.accessToken);
  set({
    status: "authenticated",
    accessToken: auth.accessToken,
    user: auth.user,
    error: null,
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
      const message = error instanceof Error ? error.message : "Login failed";
      api.setAccessToken(null);
      set({ status: "unauthenticated", accessToken: null, user: null, error: message });
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
      const message = error instanceof Error ? error.message : "Registration failed";
      api.setAccessToken(null);
      set({ status: "unauthenticated", accessToken: null, user: null, error: message });
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
    set({ status: "unauthenticated", accessToken: null, user: null, error: null });
  },
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
  });
});

export const useAuthStatus = (): AuthStatus => useAuthStore((s) => s.status);
export const useAuthUser = (): UserSummary | null => useAuthStore((s) => s.user);
export const useIsAuthenticated = (): boolean =>
  useAuthStore((s) => s.status === "authenticated");
