import type { PaymentFailure, PaymentFailureStage } from "./payment-types";

export const PAYMENT_FALLBACK_MESSAGE = "Payment failed. Please try again.";

const AUTH_PATTERN = /unauthorized|invalid token|jwt|session|not configured/i;

type ErrorLike = {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  stage?: unknown;
  env?: unknown;
};

function asRecord(value: unknown): ErrorLike | null {
  return typeof value === "object" && value !== null ? (value as ErrorLike) : null;
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function stageOf(value: unknown): PaymentFailureStage | undefined {
  return value === "config" ||
    value === "auth" ||
    value === "database" ||
    value === "request" ||
    value === "unknown"
    ? value
    : undefined;
}

/** Pulls the readable cause out of the many shapes an error reaches the browser in. */
function extractMessage(error: unknown): string | undefined {
  if (typeof error === "string") return text(error);
  if (error instanceof Error) {
    // Serialized server errors can arrive with wrapper lines prepended; the last
    // non-empty line is the one the handler actually threw.
    const lines = error.message
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return text(lines.length > 0 ? lines[lines.length - 1] : error.message);
  }
  const record = asRecord(error);
  if (!record) return undefined;
  return text(record.message) ?? text(record.details) ?? text(record.hint) ?? text(record.code);
}

/**
 * Normalizes anything thrown by (or returned from) `createPayment` into a
 * `PaymentFailure`, so both the returned-result path and the thrown auth
 * middleware path surface the same detail to the user.
 */
export function toPaymentFailure(
  error: unknown,
  fallbackStage: PaymentFailureStage = "unknown",
): PaymentFailure {
  const record = asRecord(error);
  const message = extractMessage(error) ?? PAYMENT_FALLBACK_MESSAGE;
  const explicitStage = stageOf(record?.stage);
  const stage: PaymentFailureStage =
    explicitStage ?? (AUTH_PATTERN.test(message) ? "auth" : fallbackStage);
  const code = text(record?.code);
  const env = text(record?.env);
  return {
    stage,
    message,
    ...(code ? { code } : {}),
    ...(env ? { env } : {}),
  };
}

/** The headline shown in the checkout alert: always keeps the server's own words. */
export function paymentFailureTitle(failure: PaymentFailure): string {
  const detail = failure.message.trim();
  if (!detail || detail === PAYMENT_FALLBACK_MESSAGE) return PAYMENT_FALLBACK_MESSAGE;
  return `Payment failed: ${detail}`;
}

/** Secondary line with the failure stage/code/environment so nothing is hidden. */
export function paymentFailureHint(failure: PaymentFailure): string | null {
  const parts = [
    failure.stage === "unknown" ? null : `stage: ${failure.stage}`,
    failure.code ? `code: ${failure.code}` : null,
    failure.env ? failure.env : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** True when a result/error means "this token was rejected", i.e. a refresh+retry may fix it. */
export function isAuthFailure(value: unknown): boolean {
  const failure = toPaymentFailure(value);
  return failure.stage === "auth" || AUTH_PATTERN.test(failure.message);
}
