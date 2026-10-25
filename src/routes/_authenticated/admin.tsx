import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { Layout } from "@/components/site/Layout";
import { StatusBadge } from "@/components/site/StatusBadge";
import { CardVisual, stockLabel, type CardRow } from "@/components/site/CardTile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cardsQuery } from "@/lib/cards";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Panel — vCard" }, { name: "robots", content: "noindex" }] }),
  component: Admin,
});

type Draft = Partial<CardRow> & { file?: File | null };

function Admin() {
  const { isAdmin, loading } = useAuth();
  if (loading) return <Layout><p className="p-12 font-mono text-muted-foreground">verifying access…</p></Layout>;
  if (!isAdmin) return <Layout><p className="p-12 font-mono text-destructive">ACCESS DENIED — admin only.</p></Layout>;
  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-12">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">// admin_console</p>
        <h1 className="mt-2 text-3xl font-bold">Admin panel</h1>
        <Tabs defaultValue="orders" className="mt-8">
          <TabsList><TabsTrigger value="orders">Orders</TabsTrigger><TabsTrigger value="cards">Inventory</TabsTrigger></TabsList>
          <TabsContent value="orders"><OrdersAdmin /></TabsContent>
          <TabsContent value="cards"><CardsAdmin /></TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function CardsAdmin() {
  const qc = useQueryClient();
  const { data: cards = [] } = useQuery(cardsQuery);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!draft?.card_name?.trim()) return toast.error("Card name required");
    setBusy(true);
    let image_url = draft.image_url ?? null;
    if (draft.file) {
      const path = `${crypto.randomUUID()}-${draft.file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const up = await supabase.storage.from("card-images").upload(path, draft.file);
      if (up.error) { setBusy(false); return toast.error(up.error.message); }
      const signed = await supabase.storage.from("card-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      image_url = signed.data?.signedUrl ?? null;
    }
    const row = {
      card_name: draft.card_name.trim(),
      card_type: draft.card_type?.trim() || "Visa",
      price_in_usd: Number(draft.price_in_usd ?? 0),
      description: draft.description ?? null,
      stock_status: draft.stock_status ?? "in_stock",
      image_url,
    };
    const res = draft.id ? await supabase.from("cards").update(row).eq("id", draft.id) : await supabase.from("cards").insert(row);
    setBusy(false);
    if (res.error) return toast.error(res.error.message);
    toast.success("Saved");
    setDraft(null);
    qc.invalidateQueries({ queryKey: ["cards"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this card?")) return;
    const { error } = await supabase.from("cards").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["cards"] });
  };

  const setStock = async (id: string, stock_status: CardRow["stock_status"]) => {
    const { error } = await supabase.from("cards").update({ stock_status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["cards"] });
  };

  return (
    <div className="mt-6 space-y-4">
      <Button variant="neon" onClick={() => setDraft({ card_type: "Visa", stock_status: "in_stock" })}><Plus /> Add card</Button>
      <div className="card-surface overflow-x-auto rounded-xl">
        <table className="w-full text-sm">
          <thead className="font-mono text-xs uppercase text-muted-foreground"><tr className="border-b border-border">{["", "Name", "Type", "Price", "Stock", ""].map((h, i) => <th key={i} className="p-3 text-left">{h}</th>)}</tr></thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id} className="border-b border-border/50">
                <td className="w-24 p-3"><CardVisual card={c} /></td>
                <td className="p-3 font-medium">{c.card_name}</td>
                <td className="p-3 font-mono">{c.card_type}</td>
                <td className="p-3 font-mono text-primary">${Number(c.price_in_usd).toFixed(2)}</td>
                <td className="p-3">
                  <Select value={c.stock_status} onValueChange={(v) => setStock(c.id, v as CardRow["stock_status"])}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(stockLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="p-3 text-right">
                  <Button size="icon" variant="ghost" onClick={() => setDraft(c)}><Pencil /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-mono">{draft?.id ? "edit_card" : "new_card"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>Name</Label><Input value={draft.card_name ?? ""} onChange={(e) => setDraft({ ...draft, card_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Type</Label><Input value={draft.card_type ?? ""} onChange={(e) => setDraft({ ...draft, card_type: e.target.value })} /></div>
                <div className="space-y-1"><Label>Price (USD)</Label><Input type="number" step="0.01" value={draft.price_in_usd ?? ""} onChange={(e) => setDraft({ ...draft, price_in_usd: Number(e.target.value) })} /></div>
              </div>
              <div className="space-y-1"><Label>Stock</Label>
                <Select value={draft.stock_status} onValueChange={(v) => setDraft({ ...draft, stock_status: v as CardRow["stock_status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(stockLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Description</Label><Textarea value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
              <div className="space-y-1"><Label>Image</Label><Input type="file" accept="image/*" onChange={(e) => setDraft({ ...draft, file: e.target.files?.[0] ?? null })} /></div>
              <Button variant="neon" className="w-full" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save card"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrdersAdmin() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "failed">("pending");
  const [approving, setApproving] = useState<{ id: string; details: string } | null>(null);
  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*, cards(card_name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const shown = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const update = async (id: string, status: "completed" | "failed", delivery_details?: string) => {
    const { error } = await supabase.from("orders").update({ status, ...(delivery_details !== undefined ? { delivery_details } : {}) }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Order ${status}`);
    setApproving(null);
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="flex gap-2">
        {(["pending", "completed", "failed", "all"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "neon" : "terminal"} onClick={() => setFilter(f)}>{f}</Button>
        ))}
      </div>
      <div className="card-surface overflow-x-auto rounded-xl">
        <table className="w-full text-sm">
          <thead className="font-mono text-xs uppercase text-muted-foreground"><tr className="border-b border-border">{["Date", "Card", "Amount", "Method", "Tx hash", "Wallet", "Status", ""].map((h, i) => <th key={i} className="p-3 text-left">{h}</th>)}</tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={8} className="p-3 text-muted-foreground">No orders.</td></tr>}
            {shown.map((o) => (
              <tr key={o.id} className="border-b border-border/50">
                <td className="p-3">{new Date(o.created_at).toLocaleString()}</td>
                <td className="p-3">{o.cards?.card_name ?? "—"}</td>
                <td className="p-3 font-mono">${Number(o.amount_usd ?? 0).toFixed(2)}</td>
                <td className="p-3 font-mono">{o.crypto_method}</td>
                <td className="max-w-[180px] break-all p-3 font-mono text-xs">{o.transaction_hash}</td>
                <td className="max-w-[140px] break-all p-3 font-mono text-xs">{o.wallet_address ?? "—"}</td>
                <td className="p-3"><StatusBadge status={o.status} /></td>
                <td className="whitespace-nowrap p-3 text-right">
                  <Button size="icon" variant="ghost" title="Approve" onClick={() => setApproving({ id: o.id, details: o.delivery_details ?? "" })}><Check /></Button>
                  {o.status !== "failed" && <Button size="icon" variant="ghost" title="Mark failed" onClick={() => update(o.id, "failed")}><X /></Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-mono">approve_order</DialogTitle></DialogHeader>
          {approving && (
            <div className="space-y-3">
              <Label>Card delivery details (shown to the customer)</Label>
              <Textarea rows={5} className="font-mono" placeholder={"Card number, expiry, CVV, redemption link…"} value={approving.details} onChange={(e) => setApproving({ ...approving, details: e.target.value })} />
              <Button variant="neon" className="w-full" onClick={() => update(approving.id, "completed", approving.details)}>Mark completed</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
