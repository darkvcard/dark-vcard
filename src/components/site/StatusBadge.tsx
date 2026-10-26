const styles = {
  pending: "border-primary/60 text-primary",
  pending_approval: "border-primary/60 text-primary",
  completed: "border-success/60 text-success",
  failed: "border-destructive/60 text-destructive",
} as const;
const labels = { pending: "awaiting payment", pending_approval: "under review", completed: "completed", failed: "rejected" } as const;

export function StatusBadge({ status }: { status: keyof typeof styles }) {
  return <span className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase ${styles[status]}`}>{labels[status]}</span>;
}
