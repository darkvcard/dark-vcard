import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Check, X, Search } from "lucide-react";
import { Layout } from "@/components/site/Layout";
import { SectionSkeleton } from "@/components/site/LoadingSkeletons";
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
import { customerEmail, filterAdminOrders, type OrderStatusFilter } from "@/lib/admin-orders";
import { adminUserEmails } from "@/lib/payment.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Panel — vCard" }, { name: "description", content: "Manage vCard inventory and payment verification." }, { property: "og:title", content: "Admin Panel — vCard" }, { property: "og:description", content: "Manage vCard inventory and payment verification." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Admin,
});

type Draft = Partial<CardRow> & { file?: File | null };

const explorerUrl = (method: string, txid: string) =>
  method === "USDT-SOLANA" ? `https://solscan.io/tx/${txid}` : `https://bscscan.com/tx/${txid}`;

function Admin() {
  const { isAdmin, loading, roleLoading } = useAuth();
  if (loading || roleLoading) {
    return (
      <Layout>
        <div className="mx-auto max-w-7xl px-4 py-12">
          <SectionSkeleton rows={4} label="Verifying admin access" />
        </div>
      </Layout>
    );
  }
  if (!isAdmin) return <Layout><p className="p-12 font-mono text-destructive">ACCESS DENIED — admin only.</p></Layout>;
  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-12">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">// admin_console</p>
        <h1 className="mt-2 text-3xl font-bold">Admin panel</h1>
        <Tabs defaultValue="orders" className="mt-8">
          <TabsList><TabsTrigger value="orders">Orders</TabsTrigger><TabsTrigger value="cards">Inventory</TabsTrigger><TabsTrigger value="delivery">Card details</TabsTrigger></TabsList>
          <TabsContent value="orders"><OrdersAdmin /></TabsContent>
          <TabsContent value="cards"><CardsAdmin /></TabsContent>
          <TabsContent value="delivery"><DeliveryInventory /></TabsContent>
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
    if (!draft?.card_name?.trim()) { toast.error("Card name required"); return; }
    setBusy(true);
    let image_url = draft.image_url ?? null;
    if (draft.file) {
      const path = `${crypto.randomUUID()}-${draft.file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const up = await supabase.storage.from("card-images").upload(path, draft.file);
      if (up.error) { setBusy(false); { toast.error(up.error.message); return; } }
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
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Saved");
    setDraft(null);
    qc.invalidateQueries({ queryKey: ["cards"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this card?")) return;
    const { error } = await supabase.from("cards").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["cards"] });
  };

  const setStock = async (id: string, stock_status: CardRow["stock_status"]) => {
    const { error } = await supabase.from("cards").update({ stock_status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
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
                <Select value={draft.stock_status ?? "in_stock"} onValueChange={(v) => setDraft({ ...draft, stock_status: v as CardRow["stock_status"] })}>
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
  const fetchEmails = useServerFn(adminUserEmails);
  const [filter, setFilter] = useState<OrderStatusFilter>("pending_approval");
  const [search, setSearch] = useState("");
  const [approving, setApproving] = useState<{ id: string; details: string } | null>(null);
  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*, cards(card_name), payment_invoices(*)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  // Customer emails come from the admin-only server lookup, never from a public
  // table read. If the lookup fails the orders still render without emails.
  const { data: emails = {} } = useQuery({
    queryKey: ["admin-user-emails"],
    queryFn: async () => {
      try {
        return await fetchEmails();
      } catch (error) {
        console.error("[admin] customer email lookup failed", error);
        return {};
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const shown = filterAdminOrders(orders, { status: filter, search, emails });

  const resolve = async (id: string, approve: boolean, details?: string) => {
    const { error } = await supabase.rpc("resolve_payment", { p_order_id: id, p_approve: approve, ...(details ? { p_details: details } : {}) });
    if (error) { toast.error(error.message); return; }
    toast.success(approve ? "Payment approved — card delivered" : "Payment rejected");
    setApproving(null);
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
    qc.invalidateQueries({ queryKey: ["card-units"] });
  };
  const approve = (id: string, details: string) => resolve(id, true, details);
  const reject = (id: string) => { if (confirm("Reject this payment?")) resolve(id, false); };

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["pending_approval", "pending", "completed", "failed", "all"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "neon" : "terminal"} onClick={() => setFilter(f)}>{f === "pending_approval" ? "to review" : f === "pending" ? "awaiting payment" : f}</Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            className="pl-9 font-mono"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer email or TXID"
            aria-label="Search orders by customer email or TXID"
          />
        </div>
        {search && <Button size="sm" variant="terminal" onClick={() => setSearch("")}>Clear</Button>}
        <span className="font-mono text-xs text-muted-foreground">{shown.length} order{shown.length === 1 ? "" : "s"}</span>
      </div>
      <div className="card-surface overflow-x-auto rounded-xl">
        <table className="w-full text-sm">
          <thead className="font-mono text-xs uppercase text-muted-foreground"><tr className="border-b border-border">{["Date", "Customer Email", "Card", "Amount", "Method", "TXID", "Status", ""].map((h, i) => <th key={i} className="p-3 text-left">{h}</th>)}</tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={8} className="p-3 text-muted-foreground">No orders.</td></tr>}
            {shown.map((o) => {
              const email = customerEmail(o, emails);
              return (
                <tr key={o.id} className="border-b border-border/50">
                  <td className="p-3">{new Date(o.created_at).toLocaleString()}</td>
                  <td className="max-w-[220px] break-all p-3 font-mono text-xs">{email ? <a className="text-primary underline" href={`mailto:${email}`}>{email}</a> : <span className="text-muted-foreground">{o.user_id}</span>}</td>
                  <td className="p-3">{o.cards?.card_name ?? "—"}</td>
                  <td className="p-3 font-mono">{o.payment_invoices ? `${o.payment_invoices.amount_display} USDT` : `$${Number(o.amount_usd ?? 0).toFixed(2)}`}</td>
                  <td className="p-3 font-mono">{o.crypto_method}</td>
                  <td className="max-w-[220px] break-all p-3 font-mono text-xs">{o.txid ? <a className="text-primary underline" target="_blank" rel="noreferrer" href={explorerUrl(o.crypto_method, o.txid)}>{o.txid}</a> : <span className="text-muted-foreground">Not submitted</span>}</td>
                  <td className="p-3"><StatusBadge status={o.status} /></td>
                  <td className="whitespace-nowrap p-3 text-right">
                    {o.status !== "completed" && <div className="flex justify-end gap-2">
                      <Button size="sm" variant="neon" onClick={() => setApproving({ id: o.id, details: o.delivery_details ?? "" })}><Check /> Approve Payment</Button>
                      {o.status !== "failed" && <Button size="sm" variant="destructive" onClick={() => reject(o.id)}><X /> Reject Payment</Button>}
                    </div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-mono">approve_payment</DialogTitle></DialogHeader>
          {approving && (
            <div className="space-y-3">
              <Label>Card details shown to the customer</Label>
              <Textarea rows={5} className="font-mono" placeholder={"Leave empty to use a stored card from Card details, or type: card number, expiry, CVV…"} value={approving.details} onChange={(e) => setApproving({ ...approving, details: e.target.value })} />
              <Button variant="neon" className="w-full" onClick={() => approve(approving.id, approving.details)}>Approve Payment</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeliveryInventory() {
  const qc = useQueryClient();
  const { data: cards = [] } = useQuery(cardsQuery);
  const { data: units = [] } = useQuery({ queryKey: ["card-units"], queryFn: async () => {
    const result = await supabase.from("card_units").select("id,card_id,reserved_order_id,delivered_at").order("created_at", { ascending: false });
    if (result.error) throw result.error;
    return result.data;
  } });
  const [cardId, setCardId] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!cardId || !details.trim()) { toast.error("Select a card and enter its delivery details."); return; }
    setBusy(true);
    const result = await supabase.from("card_units").insert({ card_id: cardId, delivery_details: details.trim() });
    setBusy(false);
    if (result.error) { toast.error(result.error.message); return; }
    setDetails(""); toast.success("Private card added for automatic delivery"); qc.invalidateQueries({ queryKey: ["card-units"] });
  };
  return <div className="mt-6 space-y-6">
    <h2 className="text-xl font-semibold">Private delivery inventory</h2>
    <div className="max-w-xl space-y-3">
      <Label>Card product</Label><Select value={cardId} onValueChange={setCardId}><SelectTrigger><SelectValue placeholder="Select card" /></SelectTrigger><SelectContent>{cards.map(c => <SelectItem value={c.id} key={c.id}>{c.card_name}</SelectItem>)}</SelectContent></Select>
      <Label htmlFor="private-details">One card’s delivery details</Label><Textarea id="private-details" rows={5} className="font-mono" value={details} onChange={e => setDetails(e.target.value)} placeholder="Card number, expiry, CVV, redemption link…" />
      <Button variant="neon" disabled={busy} onClick={add}><Plus />{busy ? "Saving…" : "Add private card"}</Button>
    </div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border"><th className="p-3 text-left">Product</th><th className="p-3 text-left">Delivery state</th><th className="p-3 text-left">Order ID</th></tr></thead><tbody>{units.map(unit => <tr key={unit.id} className="border-b border-border"><td className="p-3">{cards.find(c => c.id === unit.card_id)?.card_name}</td><td className="p-3">{unit.delivered_at ? "Delivered" : unit.reserved_order_id ? "Reserved" : "Available"}</td><td className="break-all p-3 font-mono text-xs">{unit.reserved_order_id ?? "—"}</td></tr>)}{units.length === 0 && <tr><td colSpan={3} className="p-3 text-muted-foreground">No private cards available for automatic delivery.</td></tr>}</tbody></table></div>
  </div>;
}
