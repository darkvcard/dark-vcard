import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { CRYPTO_METHODS, isValidTxid, paymentUri } from "@/lib/payments";
import type { Invoice } from "@/lib/payment-types";

export function WaitingForPayment({ invoice, onDone }: { invoice: Invoice; onDone?: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [txid, setTxid] = useState("");
  const [busy, setBusy] = useState(false);
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast.success("Copied"); } catch { toast.error("Could not copy. Please select the text."); } };
  const submit = async () => {
    if (!isValidTxid(txid)) { toast.error("Paste the full transaction hash (TXID) from your wallet."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("submit_payment_proof", { p_order_id: invoice.order_id, p_txid: txid.trim() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["my-orders"] });
    onDone?.();
    navigate({ to: "/thank-you" });
  };
  return <div className="space-y-5">
    <p className="text-sm text-muted-foreground">{CRYPTO_METHODS.find(m => m.id === invoice.method)?.label}</p>
    <div className="flex justify-center"><QRCodeSVG value={paymentUri(invoice)} size={184} marginSize={3} className="payment-qr" /></div>
    <div className="text-center"><p className="text-xs uppercase text-muted-foreground">Exact amount</p><p className="mt-1 font-mono text-3xl text-primary">{invoice.amount_display} <span className="text-lg">USDT</span></p></div>
    <div className="space-y-2"><p className="text-xs text-muted-foreground">Receiving wallet</p><div className="flex items-start gap-2"><code className="min-w-0 flex-1 break-all text-sm">{invoice.recipient}</code><Button variant="ghost" size="icon" title="Copy receiving wallet" aria-label="Copy receiving wallet" onClick={() => copy(invoice.recipient)}><Copy /></Button></div></div>
    <div className="space-y-1"><p className="text-xs text-muted-foreground">Order ID{invoice.method === "USDT-SOLANA" ? " (add as memo if your wallet supports it)" : ""}</p><div className="flex items-start gap-2"><code className="min-w-0 flex-1 break-all text-xs text-primary">{invoice.memo}</code><Button variant="ghost" size="icon" title="Copy order ID" aria-label="Copy order ID" onClick={() => copy(invoice.memo)}><Copy /></Button></div></div>
    <p className="text-sm text-muted-foreground">{invoice.method === "USDT-SOLANA" ? "Send USDT on Solana only." : "Send USDT on BNB Smart Chain (BEP20) only."} Keep network fees separate, then paste your transaction hash below.</p>
    <div className="space-y-2 border-t border-border pt-4">
      <Label htmlFor="txid">Transaction Hash (TXID)</Label>
      <Input id="txid" className="font-mono" placeholder={invoice.method === "USDT-SOLANA" ? "5VERv8NMvz…" : "0x…"} value={txid} onChange={(e) => setTxid(e.target.value)} />
      <Button variant="neon" className="w-full" disabled={busy || !txid.trim()} onClick={submit}>{busy ? "Submitting…" : "Submit Payment Proof"}</Button>
    </div>
  </div>;
}
