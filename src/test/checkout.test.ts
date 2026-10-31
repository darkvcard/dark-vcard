import { describe, expect, it } from "vitest";

import {
  CHECKOUT_NETWORKS,
  awaitingVerification,
  networkById,
  orderInsertErrorMessage,
  orderInsertPayload,
  usdAmount,
  validateTxid,
} from "@/lib/checkout";
import { paymentMethodLabel } from "@/lib/payments";

const txid = `0x${"a".repeat(64)}`;

describe("Checkout networks", () => {
  it("offers BEP20 and Solana with their static receiving addresses", () => {
    expect(CHECKOUT_NETWORKS.map((n) => n.label)).toEqual([
      "USDT - BNB Smart Chain (BEP20)",
      "USDT - Solana",
    ]);
    expect(networkById("USDT-BEP20").address).toBe("0x35aec7E35F65ea227e49fDd321709D52Ada389E4");
    expect(networkById("USDT-SOLANA").address).toBe("3mjR2gV3MJrudjus9yBuh3EtSMw6Ca5BVFcYiMDa1VjQ");
  });

  it("falls back to the first network for an unknown selection", () => {
    expect(networkById("DOGE").id).toBe("USDT-BEP20");
  });

  it("shows the stored method id as a readable payment method", () => {
    expect(paymentMethodLabel("USDT-BEP20")).toBe("USDT - BEP20");
    expect(paymentMethodLabel("USDT-SOLANA")).toBe("USDT - Solana");
    expect(paymentMethodLabel("legacy-method")).toBe("legacy-method");
  });
});

describe("Checkout amount", () => {
  it("always renders two decimals", () => {
    expect(usdAmount(55)).toBe("$55.00");
    expect(usdAmount(55.5)).toBe("$55.50");
    expect(usdAmount(null)).toBe("$0.00");
  });
});

describe("TXID validation", () => {
  it("rejects an empty value with the checkout error", () => {
    expect(validateTxid("   ")).toBe("Paste your Transaction Hash (TXID) before confirming.");
  });

  it("rejects hashes that are too short or contain separators", () => {
    expect(validateTxid("0xabc")).not.toBeNull();
    expect(validateTxid(`${txid.slice(0, 30)}-${txid.slice(31)}`)).not.toBeNull();
  });

  it("accepts a BEP20 hash and a Solana signature", () => {
    expect(validateTxid(txid)).toBeNull();
    expect(validateTxid(" 5VERv8NMvzbzYJb9hZkZk9Qp1s5uqJ9o1F6Tz7dGz3dGz3dGz3dGz3dGz3 ")).toBeNull();
  });
});

describe("Order insert payload", () => {
  it("writes the signed-in user, card, method, amount, TXID and pending status", () => {
    expect(
      orderInsertPayload({
        userId: "user-1",
        cardId: "card-1",
        method: "USDT-SOLANA",
        priceUsd: 108,
        txid: `  ${txid}  `,
      }),
    ).toEqual({
      user_id: "user-1",
      card_id: "card-1",
      crypto_method: "USDT-SOLANA",
      amount_usd: 108,
      txid,
      status: "pending",
    });
  });
});

describe("Order insert errors", () => {
  it("explains a duplicate transaction hash", () => {
    expect(orderInsertErrorMessage({ code: "23505", message: "duplicate key value" })).toMatch(
      /already submitted/i,
    );
  });

  it("explains a missing insert permission", () => {
    expect(orderInsertErrorMessage({ code: "42501", message: "permission denied" })).toMatch(
      /not allowed to place this order/i,
    );
  });

  it("falls back to the database message", () => {
    expect(orderInsertErrorMessage({ message: "Card not found" })).toBe("Card not found");
  });
});

describe("Verification state", () => {
  it("treats a pending order with a TXID as awaiting verification", () => {
    expect(awaitingVerification({ status: "pending", txid })).toBe(true);
    expect(awaitingVerification({ status: "pending", txid: null })).toBe(false);
    expect(awaitingVerification({ status: "completed", txid })).toBe(false);
  });
});
