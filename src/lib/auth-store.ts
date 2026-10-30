import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * One shared auth state for the whole app.
 *
 * Every component used to call `supabase.auth.getSession()` on mount, so each
 * page/navbar started life believing nobody was signed in (`user: null`) and
 * then flipped once the async read resolved — which is what made the navbar
 * flash "Sign in" and the dashboard flash its empty state while navigating.
 *
 * This store resolves the session once, caches the admin role per user and
 * pushes every change to all subscribers, so navigating between pages keeps
 * the already known auth state and never renders a wrong intermediate state.
 */
export type AuthSnapshot = {
  user: User | null;
  isAdmin: boolean;
  /** True until the stored session has been read for the first time. */
  loading: boolean;
  /** True while the admin role of the signed-in user is still being resolved. */
  roleLoading: boolean;
};

const INITIAL: AuthSnapshot = { user: null, isAdmin: false, loading: true, roleLoading: false };

let snapshot: AuthSnapshot = INITIAL;
const listeners = new Set<() => void>();
const roleCache = new Map<string, boolean>();
const roleRequests = new Map<string, Promise<boolean>>();
let started = false;
let stopAuthListener: (() => void) | null = null;

function update(next: Partial<AuthSnapshot>) {
  const merged = { ...snapshot, ...next };
  if (
    merged.user === snapshot.user &&
    merged.isAdmin === snapshot.isAdmin &&
    merged.loading === snapshot.loading &&
    merged.roleLoading === snapshot.roleLoading
  ) {
    return;
  }
  snapshot = merged;
  for (const listener of [...listeners]) listener();
}

// `useSyncExternalStore` requires a cached snapshot: returning a new object on
// every read would loop forever.
export function getAuthSnapshot(): AuthSnapshot {
  return snapshot;
}

// The server never knows the browser session; it renders the loading skeleton
// and the client fills it in after hydration.
export function getAuthServerSnapshot(): AuthSnapshot {
  return INITIAL;
}

export function subscribeToAuth(listener: () => void) {
  listeners.add(listener);
  startAuth();
  return () => {
    listeners.delete(listener);
  };
}

function resolveAdminRole(userId: string): Promise<boolean> {
  const cached = roleCache.get(userId);
  if (cached !== undefined) return Promise.resolve(cached);
  const inFlight = roleRequests.get(userId);
  if (inFlight) return inFlight;

  const request = Promise.resolve(supabase.rpc("has_role", { _user_id: userId, _role: "admin" }))
    .then(({ data, error }) => {
      if (error) {
        console.warn("[auth] admin role lookup failed", error.message);
        return false;
      }
      const isAdmin = !!data;
      roleCache.set(userId, isAdmin);
      return isAdmin;
    })
    .catch((error: unknown) => {
      console.warn("[auth] admin role lookup failed", error);
      return false;
    })
    .finally(() => {
      roleRequests.delete(userId);
    });

  roleRequests.set(userId, request);
  return request;
}

async function applySession(session: Session | null | undefined) {
  const user = session?.user ?? null;
  if (!user) {
    update({ user: null, isAdmin: false, loading: false, roleLoading: false });
    return;
  }

  const cachedRole = roleCache.get(user.id);
  // Publish the signed-in user immediately so the navbar and page content agree
  // right away; the admin role is filled in by the same store when it resolves.
  update({ user, loading: false, isAdmin: cachedRole ?? false, roleLoading: cachedRole === undefined });
  if (cachedRole !== undefined) return;

  const isAdmin = await resolveAdminRole(user.id);
  // The session changed while the role was loading: ignore the stale result.
  if (snapshot.user?.id !== user.id) return;
  update({ isAdmin, roleLoading: false });
}

export function startAuth() {
  if (started || typeof window === "undefined") return;
  started = true;

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    void applySession(session);
  });
  stopAuthListener = () => data.subscription.unsubscribe();

  void supabase.auth
    .getSession()
    .then(({ data: sessionData, error }) => {
      if (error) console.warn("[auth] getSession failed", error.message);
      return applySession(sessionData.session);
    })
    .catch((error: unknown) => {
      console.error("[auth] session bootstrap failed", error);
      update({ loading: false, roleLoading: false });
    });
}

/** Test helper: drop the cached state so each test starts from scratch. */
export function resetAuthStore() {
  stopAuthListener?.();
  stopAuthListener = null;
  started = false;
  roleCache.clear();
  roleRequests.clear();
  snapshot = INITIAL;
}
