import { describe, expect, it } from "vitest";
import { BSC_USDT, CRYPTO_METHODS, isValidTxid, paymentUri, type PaymentRequest } from "@/lib/payments";
const invoice: PaymentRequest = { method: "USDT-BEP20", recipient: "0x35aec7E35F65ea227e49fDd321709D52Ada389E4", amount_display: "10.15", amount_units: "10150000000000000000", memo: "order-123" };
describe("Manual payment rules", () => {
  it("uses exactly the two supplied USDT receiving wallets", () => {
    expect(CRYPTO_METHODS.map(m => [m.id, m.address])).toEqual([["USDT-BEP20", "0x35aec7E35F65ea227e49fDd321709D52Ada389E4"], ["USDT-SOLANA", "3mjR2gV3MJrudjus9yBuh3EtSMw6Ca5BVFcYiMDa1VjQ"]]);
  });
  it("accepts real-looking BSC and Solana hashes and rejects junk", () => {
    expect(isValidTxid("0x" + "a".repeat(64))).toBe(true);
    expect(isValidTxid("5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW")).toBe(true);
    expect(isValidTxid("short")).toBe(false);
    expect(isValidTxid("has spaces in the hash value here")).toBe(false);
  });
  it("includes BSC chain ID, USDT contract and integer amount in payment QR", () => {
    expect(paymentUri(invoice)).toBe(`ethereum:${BSC_USDT}@56/transfer?address=${invoice.recipient}&uint256=10150000000000000000`);
  });
});
