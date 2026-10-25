import { describe, expect, it } from "vitest";
import { BSC_USDT, CRYPTO_METHODS, SOLANA_USDT, PAYMENT_POLL_MS, PAYMENT_WINDOW_MS, matchesPayment, paymentUri, type PaymentRequest, type ChainTransfer } from "@/lib/payments";
const invoice: PaymentRequest = { method: "USDT-BEP20", recipient: "0x35aec7E35F65ea227e49fDd321709D52Ada389E4", amount_display: "10.15", amount_units: "10150000000000000000", memo: "order-123", created_at: "2026-10-25T16:00:00Z", expires_at: "2026-10-25T16:30:00Z" };
const transfer: ChainTransfer = { asset: BSC_USDT, recipient: invoice.recipient, amountUnits: invoice.amount_units, timestamp: "2026-10-25T16:10:00Z", successful: true, finalized: true, reference: "bsc:abc" };
describe("Crypto payment rules", () => {
  it("uses exactly the two supplied USDT receiving wallets", () => {
    expect(CRYPTO_METHODS.map(m => [m.id, m.address])).toEqual([["USDT-BEP20", "0x35aec7E35F65ea227e49fDd321709D52Ada389E4"], ["USDT-SOLANA", "3mjR2gV3MJrudjus9yBuh3EtSMw6Ca5BVFcYiMDa1VjQ"]]);
  });
  it("matches the exact BEP20 amount, not an underpayment or overpayment", () => {
    expect(matchesPayment(invoice, transfer)).toBe(true);
    expect(matchesPayment(invoice, { ...transfer, amountUnits: "10140000000000000000" })).toBe(false);
    expect(matchesPayment(invoice, { ...transfer, amountUnits: "10160000000000000000" })).toBe(false);
  });
  it("requires canonical USDT and the receiving wallet", () => {
    expect(matchesPayment(invoice, { ...transfer, asset: "0xwrong" })).toBe(false);
    expect(matchesPayment(invoice, { ...transfer, recipient: "0xwrong" })).toBe(false);
  });
  it("enforces a 30-minute transaction window", () => {
    expect(PAYMENT_WINDOW_MS).toBe(1800000);
    expect(matchesPayment(invoice, { ...transfer, timestamp: "2026-10-25T15:59:59Z" })).toBe(false);
    expect(matchesPayment(invoice, { ...transfer, timestamp: "2026-10-25T16:30:01Z" })).toBe(false);
    expect(matchesPayment(invoice, { ...transfer, timestamp: "2026-10-25T16:30:00Z" })).toBe(true);
  });
  it("requires finalized successful transactions", () => {
    expect(matchesPayment(invoice, { ...transfer, finalized: false })).toBe(false);
    expect(matchesPayment(invoice, { ...transfer, successful: false })).toBe(false);
  });
  it("requires the Solana order ID memo alongside a real USDT transfer", () => {
    const sol = { ...invoice, method: "USDT-SOLANA", recipient: "3mjR2gV3MJrudjus9yBuh3EtSMw6Ca5BVFcYiMDa1VjQ", amount_units: "10150000" };
    const tx = { ...transfer, asset: SOLANA_USDT, recipient: sol.recipient, amountUnits: sol.amount_units, memo: sol.memo };
    expect(matchesPayment(sol, tx)).toBe(true);
    expect(matchesPayment(sol, { ...tx, memo: "wrong-order" })).toBe(false);
    expect(matchesPayment(sol, { ...tx, amountUnits: "0" })).toBe(false);
    expect(paymentUri(sol)).toContain("memo=order-123");
  });
  it("polls within the requested five to ten seconds", () => { expect(PAYMENT_POLL_MS).toBe(8000); });
  it("includes BSC chain ID, USDT contract and integer amount in payment QR", () => {
    expect(paymentUri(invoice)).toBe(`ethereum:${BSC_USDT}@56/transfer?address=${invoice.recipient}&uint256=10150000000000000000`);
  });
});