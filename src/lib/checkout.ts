// Pure helpers behind the manual crypto checkout modal. Everything here is
// framework free so the order payload and validation can be unit tested without
// rendering the dialog.
import type { TablesInsert } from "@/integrations/supabase/types";
import { CRYPTO_METHODS } from "./payments";

export type CheckoutNetwork = (typeof CRYPTO_METHODS)[number];
export type OrderInsert = TablesInsert<"orders">;

/** Networks offered in the checkout dropdown, in display order. */
export const CHECKOUT_NETWORKS = CRYPTO_METHODS;

export const DEFAULT_NETWORK_ID: string = CRYPTO_METHODS[0].id;

/** Looks up a network by id and falls back to the first one for unknown values. */
export function networkById(id: string): CheckoutNetwork {
  return CRYPTO_METHODS.find((m) => m.id === id) ?? CRYPTO_METHODS[0];
}

/** "$55.00" — never a float with more than two decimals. */
export function usdAmount(price: number | null | undefined): string {
  const value = Number(price ?? 0);
  return `$${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
}

/**
 * Returns a user facing validation message, or null when the TXID is usable.
 * Mirrors the database rule (20-200 alphanumeric characters) so the browser and
 * the server agree on what a transaction hash looks like.
 */
export function validateTxid(txid: string): string | null {
  const clean = txid.trim();
  if (!clean) return "Paste your Transaction Hash (TXID) before confirming.";
  if (clean.length < 20 || clean.length > 200 || !/^[A-Za-z0-9]+$/.test(clean)) {
    return "Enter a valid transaction hash: 20-200 letters and digits.";
  }
  return null;
}

/**
 * Row inserted into `orders` by the checkout modal. The price is informational
 * here (the database re-derives it from the card), and the order always starts
 * as `pending` until an admin verifies the TXID.
 */
export function orderInsertPayload({
  userId,
  cardId,
  method,
  priceUsd,
  txid,
}: {
  userId: string;
  cardId: string;
  method: string;
  priceUsd: number | null | undefined;
  txid: string;
}): OrderInsert {
  return {
    user_id: userId,
    card_id: cardId,
    crypto_method: method,
    amount_usd: Number(priceUsd ?? 0),
    txid: txid.trim(),
    status: "pending",
  };
}

/** Turns a Postgres/PostgREST failure into something a customer can act on. */
export function orderInsertErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    return "This transaction hash was already submitted. Contact support if you believe this is a mistake.";
  }
  if (error.code === "42501") {
    return "Your account is not allowed to place this order. Sign in again and retry.";
  }
  return error.message;
}

/** True when a submitted order is waiting for an admin to verify its TXID. */
export function awaitingVerification(order: {
  status: string;
  txid?: string | null | undefined;
}): boolean {
  return order.status === "pending" && !!order.txid;
}
