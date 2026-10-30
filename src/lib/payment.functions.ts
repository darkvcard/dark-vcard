import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "./require-user";
import type { Invoice } from "./payment-types";

// The access token is sent both in the Authorization header and in the body so
// checkout never depends on a single transport for the session.
export const createPayment = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    cardId: z.string().uuid(),
    method: z.enum(["USDT-BEP20", "USDT-SOLANA"]),
    accessToken: z.string().min(10).max(4096),
  }))
  .handler(async ({ data }) => {
    const { verifyAccessToken } = await import("./require-user.server");
    const context = await verifyAccessToken(data.accessToken);
    console.log("[createPayment] start", { user: context.userId, card: data.cardId, method: data.method });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.rpc("create_crypto_invoice", { p_user_id: context.userId, p_card_id: data.cardId, p_method: data.method });
    if (result.error) {
      console.error("[createPayment] failed", result.error.message);
      throw new Error(result.error.message);
    }
    return result.data as unknown as Invoice;
  });

// Admin only: map order user IDs to emails.
export const adminUserEmails = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw new Error(error.message);
    return Object.fromEntries(data.users.map((u) => [u.id, u.email ?? ""])) as Record<string, string>;
  });
