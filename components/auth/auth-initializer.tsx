// ─────────────────────────────────────────────────────────────────────────────
// Auth Initializer
//
// A client component that runs checkAuth() on mount.
// This populates the Zustand auth store on every page load.
//
// We use a separate component for this so the root layout
// can remain a Server Component (better performance).
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";

export function AuthInitializer() {
  const { checkAuth, isInitialized } = useAuthStore();

  useEffect(() => {
    // Only run if we haven't initialized yet
    if (!isInitialized) {
      checkAuth();
    }
  }, [checkAuth, isInitialized]);

  // Renders nothing — purely for side effects
  return null;
}
