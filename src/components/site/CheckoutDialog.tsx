import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { CRYPTO_METHODS } from "@/lib/payments";
import { createPayment } from "@/lib/payment.functions";
import type { Invoice } from "@/lib/payment-types";
import { WaitingForPayment } from "./WaitingForPayment";
import type { CardRow } from "./CardTile";

export function CheckoutDialog({ card, onClose }: { card: CardRow | null; onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [method, setMethod] = useState<string>(CRYPTO_METHODS[0].id);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [busy, setBusy] = useState(false);
  const create = useServerFn(createPayment);
  const m = CRYPTO_METHODS.find((c) => c.id === method);
  const close = () => { setInvoice(null); onClose(); };

  const [authError, setAuthError] = useState(false);
  const isAuthError = (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    return /unauthorized|401|invalid token|jwt/i.test(msg);
  };
  const expire = async () => {
    await supabase.auth.signOut();
    setAuthError(true);
    toast.error("Your session has expired. Please log in again.");
    onClose();
    navigate({ to: "/auth" });
  };

  const submit = async () => {
    if (!card || !user || !m) return;
    setBusy(true);
    setAuthError(false);
    try {
      // Make sure we have a valid, fresh session before calling the server.
      const { data } = await supabase.auth.getSession();
      const expiresSoon = !data.session || (data.session.expires_at ?? 0) * 1000 < Date.now() + 60_000;
      if (expiresSoon) {
        const { data: r, error } = await supabase.auth.refreshSession();
        if (error || !r.session) { await expire(); return; }
      }
      const payload = { data: { cardId: card.id, method: m.id } };
      try {
        setInvoice(await create(payload));
      } catch (e) {
        if (!isAuthError(e)) throw e;
        // Token rejected: refresh once and retry.
        const { data: r, error } = await supabase.auth.refreshSession();
        if (error || !r.session) { await expire(); return; }
        try { setInvoice(await create(payload)); }
        catch (e2) { if (isAuthError(e2)) { await expire(); return; } throw e2; }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create payment");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!card} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-primary/40">
        <DialogHeader>
          <DialogTitle className="font-mono">&gt; checkout_{card?.card_type.toLowerCase()}</DialogTitle>
          <DialogDescription>{card?.card_name} — <span className="text-neon font-mono">${Number(card?.price_in_usd ?? 0).toFixed(2)}</span></DialogDescription>
        </DialogHeader>
        {invoice ? <WaitingForPayment invoice={invoice} onDone={close} /> : !user ? (
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
            <p className="text-sm text-muted-foreground">You'll see the wallet and exact amount, then paste your transaction hash for admin review.</p>
            <Button variant="neon" className="w-full" disabled={busy || !m} onClick={submit}>{busy ? "Creating order…" : "Continue to payment"}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
