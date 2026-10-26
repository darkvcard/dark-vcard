import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Invoice } from "./payment-types";

export const createPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ cardId: z.string().uuid(), method: z.enum(["USDT-BEP20", "USDT-SOLANA"]) }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.rpc("create_crypto_invoice", { p_user_id: context.userId, p_card_id: data.cardId, p_method: data.method });
    if (result.error) throw new Error(result.error.message);
    return result.data as unknown as Invoice;
  });
