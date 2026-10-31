import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  CHECKOUT_NETWORKS,
  DEFAULT_NETWORK_ID,
  networkById,
  orderInsertErrorMessage,
  orderInsertPayload,
  usdAmount,
  validateTxid,
} from "@/lib/checkout";
import type { CardRow } from "./CardTile";

export function CheckoutDialog({ card, onClose }: { card: CardRow | null; onClose: () => void }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [method, setMethod] = useState<string>(DEFAULT_NETWORK_ID);
  const [txid, setTxid] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const network = networkById(method);
  const amount = usdAmount(card?.price_in_usd);

  // Reset the form whenever a different card (or no card) is opened, so a
  // half-typed transaction hash never leaks into the next purchase.
  useEffect(() => {
    setTxid("");
    setError(null);
    setBusy(false);
    setMethod(DEFAULT_NETWORK_ID);
  }, [card?.id]);

  const close = () => {
    setTxid("");
    setError(null);
    onClose();
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(network.address);
      toast.success("Wallet address copied");
    } catch (e) {
      console.warn("[checkout] clipboard write failed", e);
      toast.error("Could not copy the address. Please select it manually.");
    }
  };

  // Manual verification: the order is written with the transaction hash the
  // customer pasted, and an admin approves it later. No server function runs
  // here, so a rejected session can never block the purchase.
  const confirmPayment = async () => {
    if (!card || !user) return;
    const invalid = validateTxid(txid);
    if (invalid) {
      setError(invalid);
      toast.error(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: insertError } = await supabase.from("orders").insert(
      orderInsertPayload({
        userId: user.id,
        cardId: card.id,
        method: network.id,
        priceUsd: card.price_in_usd,
        txid,
      }),
    );
    setBusy(false);
    if (insertError) {
      const message = orderInsertErrorMessage(insertError);
      console.error("[checkout] order insert failed", insertError);
      setError(message);
      toast.error(message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["my-orders"] });
    toast.success(
      "Payment submitted successfully! We will verify your TXID and deliver your card shortly.",
    );
    close();
    navigate({ to: "/dashboard" });
  };

  return (
    <Dialog open={!!card} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-primary/40">
        <DialogHeader>
          <DialogTitle className="font-mono">
            &gt; checkout_{card?.card_type.toLowerCase()}
          </DialogTitle>
          <DialogDescription>
            {card?.card_name} —{" "}
            <span className="text-neon font-mono">
              ${Number(card?.price_in_usd ?? 0).toFixed(2)}
            </span>
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div role="status" aria-busy="true" aria-live="polite" className="space-y-3 py-2">
            <span className="sr-only">Checking your session…</span>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !user ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sign in to place an order and track delivery.
            </p>
            <Button variant="neon" className="w-full" onClick={() => navigate({ to: "/auth" })}>
              Sign in to continue
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="checkout-network">Crypto Network</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="checkout-network" aria-label="Crypto Network">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHECKOUT_NETWORKS.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkout-address">Wallet Address</Label>
              <div className="flex items-start gap-2">
                <Input
                  id="checkout-address"
                  readOnly
                  value={network.address}
                  className="font-mono text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  type="button"
                  variant="terminal"
                  size="sm"
                  className="shrink-0"
                  aria-label="Copy Address"
                  title="Copy Address"
                  onClick={copyAddress}
                >
                  <Copy /> Copy Address
                </Button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-background/60 p-3">
              <QRCodeSVG
                value={network.address}
                size={150}
                marginSize={2}
                title={`Wallet QR code for ${network.address}`}
                className="rounded bg-white p-1"
              />
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Scan to pay on {network.label}
              </p>
            </div>

            <p className="text-sm text-muted-foreground" data-testid="checkout-amount">
              Please send exactly{" "}
              <span className="font-mono font-semibold text-neon">{amount}</span> worth of crypto to
              the address above.
            </p>

            <div className="space-y-2 border-t border-border pt-4">
              <Label htmlFor="checkout-txid">Paste your Transaction Hash (TXID) here</Label>
              <Input
                id="checkout-txid"
                name="txid"
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
                placeholder={network.id === "USDT-SOLANA" ? "5VERv8NMvz…" : "0x…"}
                value={txid}
                onChange={(e) => {
                  setTxid(e.target.value);
                  if (error) setError(null);
                }}
                aria-invalid={!!error}
                aria-describedby={error ? "checkout-error" : undefined}
              />
            </div>

            {error && (
              <p
                id="checkout-error"
                role="alert"
                className="rounded border border-destructive bg-destructive/10 p-3 text-sm font-medium text-destructive"
              >
                {error}
              </p>
            )}

            <Button variant="neon" className="w-full" disabled={busy} onClick={confirmPayment}>
              {busy ? "Submitting…" : "CONFIRM PAYMENT"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Send USDT on {network.label.replace("USDT - ", "")} only. We verify every TXID by hand
              before delivering your card.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
