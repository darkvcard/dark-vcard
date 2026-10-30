import type { CreatePaymentResult, Invoice, PaymentFailureStage } from "./payment-types";

type RpcError = {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

type InvoiceRpcClient = {
  // The real Supabase client returns a thenable query builder, not a Promise.
  rpc: (
    fn: "create_crypto_invoice",
    args: { p_user_id: string; p_card_id: string; p_method: string },
  ) => PromiseLike<{ data: unknown; error: RpcError | null }>;
};

export type { InvoiceRpcClient };

export type CreateInvoiceDeps = {
  /** Resolves the service-role client for THIS request (env is read per call). */
  getClient: () => InvoiceRpcClient;
  /** Secret-free environment summary used when the client cannot be built. */
  describeEnv: () => string;
};

export type CreateInvoiceInput = {
  userId: string;
  cardId: string;
  method: "USDT-BEP20" | "USDT-SOLANA";
};

async function loadDeps(): Promise<CreateInvoiceDeps> {
  const mod = await import("@/integrations/supabase/client.server");
  return {
    getClient: () => mod.getSupabaseAdmin(),
    describeEnv: () => mod.describeSupabaseAdminEnv(),
  };
}

function configFailure(message: string, env: string): CreatePaymentResult {
  return { ok: false, stage: "config", message, env };
}

function databaseFailure(message: string, code?: string | null): CreatePaymentResult {
  return { ok: false, stage: "database", message, ...(code ? { code } : {}) };
}

/**
 * Creates the pending order + invoice for a verified user.
 * Returns the reason instead of throwing, so the message survives serialization
 * to the browser (a thrown server-function error is flattened into a generic 500).
 */
export async function createInvoiceForUser(
  input: CreateInvoiceInput,
  deps?: CreateInvoiceDeps,
): Promise<CreatePaymentResult> {
  const meta = { user: input.userId, card: input.cardId, method: input.method };
  const { getClient, describeEnv } = deps ?? (await loadDeps());

  let client: InvoiceRpcClient;
  try {
    client = getClient();
  } catch (error) {
    const env = describeEnv();
    const message = error instanceof Error ? error.message : String(error);
    console.error("[createPayment] supabase config error", { ...meta, message, env });
    return configFailure(message, env);
  }

  // `create_crypto_invoice` inserts the order with status 'pending' and the
  // matching invoice in one transaction, so a failure never leaves a half order.
  let response: { data: unknown; error: RpcError | null };
  try {
    response = await client.rpc("create_crypto_invoice", {
      p_user_id: input.userId,
      p_card_id: input.cardId,
      p_method: input.method,
    });
  } catch (error) {
    // A thrown transport error (DNS, TLS, wrong SUPABASE_URL) must not become a
    // bare 500 - report which endpoint failed to be reached.
    const message = error instanceof Error ? error.message : String(error);
    console.error("[createPayment] rpc threw", { ...meta, message });
    return { ok: false, stage: "request", message: `Could not reach the database: ${message}` };
  }

  const { data: invoice, error } = response;

  if (error) {
    // Never swallow the Postgres detail: it separates a missing RPC/migration
    // from a permission or data problem in production.
    console.error("[createPayment] rpc failed", {
      ...meta,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    const message =
      error.message?.trim() ||
      error.details?.trim() ||
      error.hint?.trim() ||
      "The database rejected the invoice request.";
    // PostgREST reports an unreachable/wrong SUPABASE_URL as a fetch failure with
    // an empty code; surface it as a request problem plus the endpoint it used.
    const transportFailure =
      !error.code &&
      /fetch failed|network|econn|enotfound|bad port|timed? ?out/i.test(
        `${message} ${error.details ?? ""}`,
      );
    if (transportFailure) {
      return {
        ok: false,
        stage: "request",
        message: `Could not reach the database: ${message}`,
        env: describeEnv(),
      };
    }
    return databaseFailure(message, error.code);
  }

  if (!invoice) {
    console.error("[createPayment] rpc returned no invoice", meta);
    return databaseFailure("Invoice creation returned no data.");
  }

  return { ok: true, invoice: invoice as Invoice };
}
