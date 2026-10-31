import { awaitingVerification } from "@/lib/checkout";

const styles = {
  pending: "border-primary/60 text-primary",
  pending_approval: "border-primary/60 text-primary",
  completed: "border-success/60 text-success",
  failed: "border-destructive/60 text-destructive",
} as const;
const labels = {
  pending: "awaiting payment",
  pending_approval: "Pending Verification",
  completed: "completed",
  failed: "rejected",
} as const;

/**
 * Status pill for an order. An order that already carries a TXID is no longer
 * "awaiting payment" but waiting for an admin to verify it, even while its
 * stored status is still `pending`.
 */
export function StatusBadge({
  status,
  txid,
}: {
  status: keyof typeof styles;
  txid?: string | null;
}) {
  const key = awaitingVerification({ status, txid }) ? "pending_approval" : status;
  return (
    <span className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase ${styles[key]}`}>
      {labels[key]}
    </span>
  );
}
