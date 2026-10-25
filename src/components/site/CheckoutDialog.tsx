import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CRYPTO_METHODS } from "@/lib/payments";
import type { CardRow } from "./CardTile";

const schema = z.object({
  tx: z.string().trim().min(10, "Enter a valid transaction hash").max(200),
  wallet: z.string().trim().max(200).optional(),
});

export function CheckoutDialog({ card, onClose }: { card: CardRow | null; onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [method, setMethod] = useState<string>(CRYPTO_METHODS[0].id);
  const [tx, setTx] = useState("");
  const [wallet, setWallet] = useState("");
  const [busy, setBusy] = useState(false);
  const m = CRYPTO_METHODS.find((c) => c.id === method)!;

  const submit = async () => {
    if (!card || !user) return;
    const parsed = schema.safeParse({ tx, wallet });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid input"); return; }
    setBusy(true);
    const { error } = await supabase.from("orders").insert({
      user_id: user.id,
      card_id: card.id,
      crypto_method: method,
      transaction_hash: parsed.data.tx,
      wallet_address: parsed.data.wallet || null,
      amount_usd: card.price_in_usd,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Order submitted — awaiting verification");
    onClose();
    navigate({ to: "/dashboard" });
  };

  return (
    <Dialog open={!!card} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-primary/40">
        <DialogHeader>
          <DialogTitle className="font-mono">&gt; checkout_{card?.card_type.toLowerCase()}</DialogTitle>
          <DialogDescription>{card?.card_name} — <span className="text-neon font-mono">${Number(card?.price_in_usd ?? 0).toFixed(2)}</span></DialogDescription>
        </DialogHeader>
        {!user ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Sign in to place an order and track delivery.</p>
            <Button variant="neon" className="w-full" onClick={() => navigate({ to: "/auth" })}>Sign in to continue</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pay with</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CRYPTO_METHODS.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border border-border bg-muted p-3">
              <p className="font-mono text-xs uppercase text-muted-foreground">Send exactly ${Number(card?.price_in_usd ?? 0).toFixed(2)} in {m.id} to:</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 break-all font-mono text-sm text-primary">{m.address}</code>
                <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(m.address); toast.success("Copied"); }}><Copy /></Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx">Transaction hash</Label>
              <Input id="tx" value={tx} onChange={(e) => setTx(e.target.value)} placeholder="0x… / txid" className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wallet">Your sending wallet (optional)</Label>
              <Input id="wallet" value={wallet} onChange={(e) => setWallet(e.target.value)} className="font-mono" />
            </div>
            <Button variant="neon" className="w-full" disabled={busy} onClick={submit}>{busy ? "Submitting…" : "Submit payment"}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
