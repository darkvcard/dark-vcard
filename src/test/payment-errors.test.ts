import { describe, expect, it } from "vitest";
import {
  PAYMENT_FALLBACK_MESSAGE,
  paymentFailureHint,
  paymentFailureTitle,
  toPaymentFailure,
} from "@/lib/payment-errors";

describe("payment failure normalization", () => {
  it("keeps the server-side config failure message, stage and environment summary", () => {
    const failure = toPaymentFailure({
      ok: false,
      stage: "config",
      message: "Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY.",
      env: "SUPABASE_URL=set SUPABASE_SERVICE_ROLE_KEY=MISSING",
    });

    expect(failure.stage).toBe("config");
    expect(failure.message).toBe(
      "Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY.",
    );
    expect(paymentFailureTitle(failure)).toBe(
      "Payment failed: Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY.",
    );
    expect(paymentFailureHint(failure)).toBe(
      "stage: config · SUPABASE_URL=set SUPABASE_SERVICE_ROLE_KEY=MISSING",
    );
  });

  it("keeps the PostgREST message and code from a returned database failure", () => {
    const failure = toPaymentFailure({
      ok: false,
      stage: "database",
      message: "permission denied for function create_crypto_invoice",
      code: "42501",
    });

    expect(failure).toMatchObject({ stage: "database", code: "42501" });
    expect(paymentFailureHint(failure)).toBe("stage: database · code: 42501");
  });

  it("classifies a thrown auth middleware error so the caller can refresh once", () => {
    const failure = toPaymentFailure(new Error("Unauthorized: session rejected"));
    expect(failure.stage).toBe("auth");
    expect(failure.message).toBe("Unauthorized: session rejected");
  });

  it("unwraps a serialized server error down to the thrown line", () => {
    const failure = toPaymentFailure(new Error("Error: HTTPError\nUnauthorized: Invalid token"));
    expect(failure.message).toBe("Unauthorized: Invalid token");
    expect(failure.stage).toBe("auth");
  });

  it("reads plain objects, strings and unknown values without leaking [object Object]", () => {
    expect(toPaymentFailure({ message: "Card unavailable", code: "P0001" }).message).toBe(
      "Card unavailable",
    );
    expect(toPaymentFailure("Card unavailable").message).toBe("Card unavailable");
    expect(toPaymentFailure(undefined).message).toBe(PAYMENT_FALLBACK_MESSAGE);
    expect(toPaymentFailure({}).message).toBe(PAYMENT_FALLBACK_MESSAGE);
  });

  it("keeps the generic message when there is nothing more specific to show", () => {
    const failure = toPaymentFailure(new Error(PAYMENT_FALLBACK_MESSAGE));
    expect(paymentFailureTitle(failure)).toBe(PAYMENT_FALLBACK_MESSAGE);
    expect(paymentFailureHint(failure)).toBeNull();
  });
});
