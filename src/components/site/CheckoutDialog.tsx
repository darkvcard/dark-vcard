import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { CRYPTO_METHODS, type PaymentMethod } from "@/lib/payments";
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

  // Every payment failure is reported here. The user is never signed out: a
  // failed payment must not destroy a valid session.
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const isAuthError = (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    return /unauthorized|invalid token|jwt|session/i.test(msg);
  };

  // Reads the live session token at call time. `force` refreshes once, which is
  // only used when the server rejected the token we just sent.
  const currentAccessToken = async (force = false) => {
    if (!force) {
      const { data, error } = await supabase.auth.getSession();
      if (error) console.warn("[checkout] getSession failed", error.message);
      const token = data.session?.access_token;
      if (token) return token;
    }
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) console.warn("[checkout] refreshSession failed", refreshError.message);
    return refreshed.session?.access_token ?? null;
  };

  const createInvoice = (token: string, cardId: string, methodId: PaymentMethod) =>
    create({
      data: { cardId, method: methodId },
      headers: { Authorization: `Bearer ${token}` },
    });

  const submit = async () => {
    if (!card || !m) return;
    setBusy(true);
    setPaymentError(null);
    try {
      // Grab the session immediately before the request and send its access
      // token as a Bearer token so the server function can authenticate it.
      let token = await currentAccessToken();
      if (!token) { setPaymentError("Payment failed. Please try again."); return; }
      try {
        setInvoice(await createInvoice(token, card.id, m.id));
      } catch (e) {
        if (!isAuthError(e)) throw e;
        // The token we sent was rejected: refresh once and retry with the new one.
        console.warn("[checkout] token rejected, retrying with a refreshed session", e);
        token = await currentAccessToken(true);
        if (!token) { setPaymentError("Payment failed. Please try again."); return; }
        setInvoice(await createInvoice(token, card.id, m.id));
      }
    } catch (error) {
      console.error("[checkout] payment failed", error);
      setPaymentError("Payment failed. Please try again.");
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
            {paymentError && (
              <div role="alert" className="rounded border border-destructive bg-destructive/10 p-3 text-sm font-medium text-destructive">
                {paymentError}
              </div>
            )}
            <Button variant="neon" className="w-full" disabled={busy || !m} onClick={submit}>{busy ? "Creating order…" : "Continue to payment"}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
