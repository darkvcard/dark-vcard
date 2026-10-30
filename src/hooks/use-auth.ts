import { useSyncExternalStore } from "react";
import { getAuthServerSnapshot, getAuthSnapshot, subscribeToAuth } from "@/lib/auth-store";

/**
 * Reads the shared auth state (see `@/lib/auth-store`).
 *
 * Because the state is shared, navigating between pages keeps the user that was
 * already resolved instead of falling back to `user: null` and flashing the
 * signed-out UI. `loading` is only true until the session is read the first time;
 * `roleLoading` is true while the admin role is still being resolved.
 */
export function useAuth() {
  return useSyncExternalStore(subscribeToAuth, getAuthSnapshot, getAuthServerSnapshot);
}

