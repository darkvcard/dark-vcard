import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Invoice } from "./payment-types";
import { bscScanUrl, bscTransferParams, parseBscScanTransfers } from "./bscscan";
import { CRYPTO_METHODS } from "./payments";

export const paymentAvailability = createServerFn({ method: "GET" }).handler(async () => ({
  "USDT-BEP20": Boolean(process.env['BSCSCAN_API_KEY']),
  "USDT-SOLANA": Boolean(process.env['HELIUS_API_KEY']),
}));

export const createPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ cardId: z.string().uuid(), method: z.enum(["USDT-BEP20", "USDT-SOLANA"]) }))
  .handler(async ({ data, context }) => {
    const configured = data.method === "USDT-BEP20" ? process.env['BSCSCAN_API_KEY'] : process.env['HELIUS_API_KEY'];
    if (!configured) throw new Error("Automatic payments on this network are not configured yet. Please contact support.");
    if (data.method === "USDT-BEP20") {
      const response = await fetch(bscScanUrl({ ...bscTransferParams(CRYPTO_METHODS[0].address, "0", "999999999", 1), offset: "1" }, configured), { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`BscScan / Etherscan verification is unavailable (${response.status}). No payment order was created.`);
      // Fail closed before reserving a card or asking the buyer to send funds.
      parseBscScanTransfers(await response.json());
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.rpc("create_crypto_invoice", { p_user_id: context.userId, p_card_id: data.cardId, p_method: data.method });
    if (result.error) throw new Error(result.error.message);
    return result.data as Invoice;
  });