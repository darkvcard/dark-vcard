export const CRYPTO_METHODS = [
  { id: "USDT-BEP20", label: "USDT · BNB Smart Chain (BEP20)", address: "0x35aec7E35F65ea227e49fDd321709D52Ada389E4" },
  { id: "USDT-SOLANA", label: "USDT · Solana", address: "3mjR2gV3MJrudjus9yBuh3EtSMw6Ca5BVFcYiMDa1VjQ" },
] as const;

export const BSC_USDT = "0x55d398326f99059ff775485246999027b3197955";
export const SOLANA_USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
export const PAYMENT_WINDOW_MS = 30 * 60 * 1000;
export const PAYMENT_POLL_MS = 8000;
export type PaymentMethod = typeof CRYPTO_METHODS[number]["id"];
export type PaymentRequest = { method: string; recipient: string; amount_display: string; amount_units: string; memo: string; created_at: string; expires_at: string };
export type ChainTransfer = { asset: string; recipient: string; amountUnits: string; memo?: string; timestamp: string; successful: boolean; finalized: boolean; reference: string };
export function matchesPayment(invoice: PaymentRequest, transfer: ChainTransfer) {
  const solana = invoice.method === "USDT-SOLANA";
  const timestamp = Date.parse(transfer.timestamp);
  return transfer.successful && transfer.finalized && Number.isFinite(timestamp)
    && timestamp >= Date.parse(invoice.created_at) && timestamp <= Date.parse(invoice.expires_at)
    && (solana ? transfer.asset === SOLANA_USDT && transfer.recipient === invoice.recipient && transfer.memo === invoice.memo
      : transfer.asset.toLowerCase() === BSC_USDT && transfer.recipient.toLowerCase() === invoice.recipient.toLowerCase())
    && transfer.amountUnits === invoice.amount_units;
}
export function paymentUri(invoice: PaymentRequest) {
  return invoice.method === "USDT-SOLANA"
    ? `solana:${invoice.recipient}?amount=${invoice.amount_display}&spl-token=${SOLANA_USDT}&memo=${encodeURIComponent(invoice.memo)}&label=vCard`
    : `ethereum:${BSC_USDT}@56/transfer?address=${invoice.recipient}&uint256=${invoice.amount_units}`;
}
