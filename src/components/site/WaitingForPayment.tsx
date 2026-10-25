import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { Clock, Copy, LoaderCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CRYPTO_METHODS, PAYMENT_POLL_MS, paymentUri } from "@/lib/payments";
import type { Invoice } from "@/lib/payment-types";

export function WaitingForPayment({ invoice, onDone }: { invoice: Invoice; onDone?: () => void }) {
  const [now, setNow] = useState(Date.now());
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["payment-status", invoice.order_id], refetchInterval: PAYMENT_POLL_MS,
    queryFn: async () => {
      const result = await supabase.from("orders").select("status, payment_invoices(*)").eq("id", invoice.order_id).single();
      if (result.error) throw result.error;
      return result.data;
    },
  });
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (data?.status !== "completed") return;
    qc.invalidateQueries({ queryKey: ["my-orders"] });
    toast.success("Payment confirmed — your card is ready");
    onDone?.();
    navigate({ to: "/dashboard" });
  }, [data?.status, navigate, onDone, qc]);
  const current = data?.payment_invoices ?? invoice;
  const seconds = Math.max(0, Math.ceil((Date.parse(invoice.expires_at) - now) / 1000));
  const expired = seconds === 0;
  const rejected = data?.status === "failed";
  const paid = current.verification_state === "paid";
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast.success("Copied"); } catch { toast.error("Could not copy. Please select the text."); } };
  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-2 border-b border-border pb-4">
      <div className="flex items-center gap-2 text-primary">{paid ? <CheckCircle2 className="size-5" /> : <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" />}<h2 className="font-semibold">{rejected ? "Payment needs review" : paid ? "Payment confirmed" : expired ? "Payment window ended" : "Waiting for Payment"}</h2></div>
      <span className="flex shrink-0 items-center gap-1 font-mono text-sm"><Clock className="size-4" />{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</span>
    </div>
    <p className="text-sm text-muted-foreground">{CRYPTO_METHODS.find(m => m.id === invoice.method)?.label}</p>
    {!expired && !rejected && <div className="flex justify-center"><QRCodeSVG value={paymentUri(invoice)} size={184} marginSize={3} className="payment-qr" /></div>}
    <div className="text-center"><p className="text-xs uppercase text-muted-foreground">Exact amount</p><p className="mt-1 font-mono text-3xl text-primary">{invoice.amount_display} <span className="text-lg">USDT</span></p></div>
    <div className="space-y-2"><p className="text-xs text-muted-foreground">Receiving wallet</p><div className="flex items-start gap-2"><code className="min-w-0 flex-1 break-all text-sm">{invoice.recipient}</code><Button variant="ghost" size="icon" title="Copy receiving wallet" aria-label="Copy receiving wallet" onClick={() => copy(invoice.recipient)}><Copy /></Button></div></div>
    <div className="space-y-1"><p className="text-xs text-muted-foreground">{invoice.method === "USDT-SOLANA" ? "Required transaction memo / order ID" : "Order ID"}</p><div className="flex items-start gap-2"><code className="min-w-0 flex-1 break-all text-xs text-primary">{invoice.memo}</code><Button variant="ghost" size="icon" title="Copy order ID" aria-label="Copy order ID" onClick={() => copy(invoice.memo)}><Copy /></Button></div></div>
    <p className="text-sm text-muted-foreground">{rejected ? "Contact support before sending any funds." : expired ? "Do not send a new payment. Payments sent during the lock are still checked; late payments require manual review." : invoice.method === "USDT-SOLANA" ? "Send USDT on Solana with this exact memo. Use a wallet that supports transaction memos; keep network fees separate." : "Send the exact USDT amount on BNB Smart Chain only. Keep network fees separate; do not send BNB or USDT on another network."}</p>
    {(error || current.last_error) && <p role="status" className="text-sm text-destructive">Payment checks are temporarily unavailable. Your order is saved; contact support if this continues.</p>}
    <p className="text-center text-xs text-muted-foreground">{paid ? "Preparing your card…" : "Awaiting blockchain confirmation"}</p>
  </div>;
}