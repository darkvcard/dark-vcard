import type { Tables } from "@/integrations/supabase/types";
export type Invoice = Tables<"payment_invoices">;

/** Where a checkout failure happened, so the client can show - and users can report - the real cause. */
export type PaymentFailureStage = "config" | "auth" | "database" | "request" | "unknown";

export type PaymentFailure = {
  stage: PaymentFailureStage;
  /** Human readable cause, e.g. "Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY." */
  message: string;
  /** Postgres/PostgREST error code when the database rejected the call. */
  code?: string;
  /** Secret-free environment summary for config failures. */
  env?: string;
};

/**
 * `createPayment` never throws for predictable failures: it returns the reason
 * so the message survives serialization to the browser instead of being
 * collapsed into a generic 500 by the server function transport.
 */
export type CreatePaymentResult = { ok: true; invoice: Invoice } | ({ ok: false } & PaymentFailure);
