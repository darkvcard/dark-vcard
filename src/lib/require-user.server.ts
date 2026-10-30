import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Validates a bearer token with the auth server (getUser) instead of local
// JWT claim verification, which was rejecting valid sessions in production.
export async function verifyAccessToken(explicitToken?: string | null) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    console.error("[auth] Supabase environment variables are missing");
    throw new Error("Unauthorized: auth backend is not configured");
  }
  // The Authorization header is the canonical transport; a caller-supplied
  // token is only used as a fallback when the header is absent.
  const header = getRequest()?.headers.get("authorization") ?? "";
  const headerToken = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const candidates = [headerToken, explicitToken].filter((t): t is string => !!t && t.split(".").length === 3);
  if (candidates.length === 0) {
    console.error("[auth] no bearer token on request");
    throw new Error("Unauthorized: no session token");
  }
  for (const token of [...new Set(candidates)]) {
    const supabase = createClient<Database>(url, key, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          h.set("apikey", key);
          // Keep the user's token as the Authorization header; the public key is
          // only ever sent as `apikey`.
          h.set("Authorization", `Bearer ${token}`);
          return fetch(input, { ...init, headers: h });
        },
      },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (data.user) return { supabase, userId: data.user.id, email: data.user.email ?? null };
    console.error("[auth] token rejected:", error?.message);
  }
  throw new Error("Unauthorized: session rejected");
}

