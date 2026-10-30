import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "./require-user";
import type { Invoice } from "./payment-types";

// Authenticated server function: the browser sends the session access token as
// `Authorization: Bearer <token>` right before the call and `requireUser`
// verifies it with the auth server before any invoice is created.
export const createPayment = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator(z.object({
    cardId: z.string().uuid(),
    method: z.enum(["USDT-BEP20", "USDT-SOLANA"]),
  }))
  .handler(async ({ data, context }) => {
    console.log("[createPayment] start", { user: context.userId, card: data.cardId, method: data.method });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // `create_crypto_invoice` inserts the order with status 'pending' and the
    // matching invoice in one transaction, so a failure never leaves a half order.
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
