import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "./require-user";
import type { CreatePaymentResult } from "./payment-types";

// Authenticated server function: the browser sends the session access token as
// `Authorization: Bearer <token>` right before the call and `requireUser`
// verifies it with the auth server before any invoice is created.
export const createPayment = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator(
    z.object({
      cardId: z.string().uuid(),
      method: z.enum(["USDT-BEP20", "USDT-SOLANA"]),
    }),
  )
  .handler(async ({ data, context }): Promise<CreatePaymentResult> => {
    console.log("[createPayment] start", {
      user: context.userId,
      card: data.cardId,
      method: data.method,
    });
    // Imported lazily: the core resolves the service-role client per request and
    // must never end up in the client bundle.
    const { createInvoiceForUser } = await import("./payment.server");
    return createInvoiceForUser({
      userId: context.userId,
      cardId: data.cardId,
      method: data.method,
    });
  });

// Admin only: map order user IDs to emails.
export const adminUserEmails = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await getSupabaseAdmin().auth.admin.listUsers({ perPage: 1000 });
    if (error) throw new Error(`Could not list users: ${error.message}`);
    return Object.fromEntries(data.users.map((u) => [u.id, u.email ?? ""])) as Record<
      string,
      string
    >;
  });
