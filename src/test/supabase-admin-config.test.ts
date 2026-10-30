// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  describeSupabaseAdminEnv,
  getSupabaseAdmin,
  readSupabaseAdminConfig,
} from "@/integrations/supabase/client.server";

const TRACKED = [
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
] as const;

describe("server-side Supabase configuration", () => {
  const saved = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const name of TRACKED) {
      saved.set(name, process.env[name]);
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const name of TRACKED) {
      const value = saved.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("reports exactly which variable is missing instead of failing at import time", () => {
    process.env["SUPABASE_URL"] = "https://example.supabase.co";

    expect(() => getSupabaseAdmin()).toThrow(
      "Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY.",
    );
    expect(describeSupabaseAdminEnv()).toContain("SUPABASE_URL=set");
    expect(describeSupabaseAdminEnv()).toContain("SUPABASE_SERVICE_ROLE_KEY=MISSING");
  });

  it("reads process.env per call so a late-injected runtime env is picked up", () => {
    expect(readSupabaseAdminConfig().ok).toBe(false);

    process.env["SUPABASE_URL"] = "https://first.example.supabase.co";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "sb_secret_first";
    const first = getSupabaseAdmin();
    expect(typeof first.rpc).toBe("function");

    // A later request (or a worker with different bindings) must see new values.
    process.env["SUPABASE_URL"] = "https://second.example.supabase.co";
    const resolved = readSupabaseAdminConfig();
    expect(resolved.ok && resolved.config.url).toBe("https://second.example.supabase.co");
    expect(getSupabaseAdmin()).not.toBe(first);
  });

  it("reuses the client for the same url+key pair", () => {
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "sb_secret_same";
    expect(getSupabaseAdmin()).toBe(getSupabaseAdmin());
  });

  it("falls back to VITE_SUPABASE_URL and reports which variable supplied the URL", () => {
    process.env["VITE_SUPABASE_URL"] = "https://public.example.supabase.co";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "sb_secret_x";

    const resolved = readSupabaseAdminConfig();
    expect(resolved.ok && resolved.config.urlSource).toBe("VITE_SUPABASE_URL");
    expect(describeSupabaseAdminEnv()).toContain("host=public.example.supabase.co");
  });

  it("never prints key material in the environment summary", () => {
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "sb_secret_do_not_leak";

    expect(describeSupabaseAdminEnv()).not.toContain("sb_secret_do_not_leak");
  });
});
