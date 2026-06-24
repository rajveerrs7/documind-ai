// ─────────────────────────────────────────────────────────────────────────────
// Auth Store — Zustand
//
// Manages client-side authentication state.
// The source of truth is always the server (JWT cookie),
// but we cache user data here for fast UI rendering.
//
// On app load, we call /api/auth/me to populate this store.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuthUser } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UsageData {
  month: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  limit: number;
  percentUsed: number;
  remainingTokens: number;
}

interface AuthState {
  // Current user (null if not authenticated)
  user:
    | (AuthUser & {
        documentCount?: number;
        chatCount?: number;
        createdAt?: string;
      })
    | null;

  // Current month's usage data
  usage: UsageData | null;

  // Loading state for initial auth check
  isLoading: boolean;

  // Whether we've done the initial auth check
  isInitialized: boolean;

  // Actions
  setUser: (user: AuthState["user"]) => void;
  setUsage: (usage: UsageData) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;

  // Async actions
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      usage: null,
      isLoading: true,
      isInitialized: false,

      setUser: (user) => set({ user }),
      setUsage: (usage) => set({ usage }),
      clearAuth: () => set({ user: null, usage: null }),
      setLoading: (isLoading) => set({ isLoading }),

      /**
       * Checks authentication status by calling /api/auth/me.
       * Called on app initialization and after login.
       */
      checkAuth: async () => {
        set({ isLoading: true });
        try {
          const response = await fetch("/api/auth/me", {
            credentials: "include", // Include cookies
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              set({
                user: data.data.user,
                usage: data.data.usage,
                isLoading: false,
                isInitialized: true,
              });
              return;
            }
          }

          // Not authenticated
          set({
            user: null,
            usage: null,
            isLoading: false,
            isInitialized: true,
          });
        } catch (error) {
          console.error("[AuthStore] checkAuth failed:", error);
          set({
            user: null,
            usage: null,
            isLoading: false,
            isInitialized: true,
          });
        }
      },

      /**
       * Logs out the user.
       * Calls logout API, then clears local state.
       */
      logout: async () => {
        try {
          await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include",
          });
        } catch (error) {
          console.error("[AuthStore] Logout API call failed:", error);
        } finally {
          // Always clear local state, even if API call failed
          set({
            user: null,
            usage: null,
            isInitialized: true,
          });
          // Redirect to login
          window.location.href = "/login";
        }
      },
    }),
    {
      name: "documind-auth",
      // Only persist user and usage (not loading states)
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        usage: state.usage,
      }),
    },
  ),
);
