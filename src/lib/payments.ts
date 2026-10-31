export const CRYPTO_METHODS = [
  {
    id: "USDT-BEP20",
    label: "USDT - BNB Smart Chain (BEP20)",
    paymentMethod: "USDT - BEP20",
    address: "0x35aec7E35F65ea227e49fDd321709D52Ada389E4",
  },
  {
    id: "USDT-SOLANA",
    label: "USDT - Solana",
    paymentMethod: "USDT - Solana",
    address: "3mjR2gV3MJrudjus9yBuh3EtSMw6Ca5BVFcYiMDa1VjQ",
  },
] as const;

/**
 * Human readable label for the `orders.crypto_method` column, e.g.
 * "USDT-BEP20" -> "USDT - BEP20". Unknown values are shown untouched so old
 * rows never render as blank.
 */
export function paymentMethodLabel(method: string): string {
  return CRYPTO_METHODS.find((m) => m.id === method)?.paymentMethod ?? method;
}

export const BSC_USDT = "0x55d398326f99059ff775485246999027b3197955";
export const SOLANA_USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
export type PaymentMethod = (typeof CRYPTO_METHODS)[number]["id"];
export type PaymentRequest = {
  method: string;
  recipient: string;
  amount_display: string;
  amount_units: string;
  memo: string;
};

/** Mirrors the database check in submit_payment_proof. */
export function isValidTxid(txid: string) {
  const t = txid.trim();
  return t.length >= 20 && t.length <= 200 && /^[A-Za-z0-9]+$/.test(t);
}

export function paymentUri(invoice: PaymentRequest) {
  return invoice.method === "USDT-SOLANA"
    ? `solana:${invoice.recipient}?amount=${invoice.amount_display}&spl-token=${SOLANA_USDT}&memo=${encodeURIComponent(invoice.memo)}&label=vCard`
    : `ethereum:${BSC_USDT}@56/transfer?address=${invoice.recipient}&uint256=${invoice.amount_units}`;
}
