import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/site/Layout";
import { SectionSkeleton } from "@/components/site/LoadingSkeletons";
import { StatusBadge } from "@/components/site/StatusBadge";
import { CardVisual } from "@/components/site/CardTile";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { paymentMethodLabel } from "@/lib/payments";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "My Dashboard — vCard" }, { name: "description", content: "Your purchased cards and crypto payment history." }, { property: "og:title", content: "My Dashboard — vCard" }, { property: "og:description", content: "Your purchased cards and crypto payment history." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, loading } = useAuth();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !loading && !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("orders").select("*, cards(*), payment_invoices(*)").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const owned = orders.filter((o) => o.status === "completed");

  // Hold the page on a skeleton until the shared auth state is known, so the
  // dashboard never renders its "no cards / no orders" state before the session
  // (and then flip once the user arrives).
  if (loading) {
    return (
      <Layout>
        <div className="mx-auto max-w-7xl px-4 py-12">
          <SectionSkeleton rows={4} label="Loading your dashboard" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-7xl space-y-12 px-4 py-12">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-primary">// session: {user?.email}</p>
          <h1 className="mt-2 text-3xl font-bold">Dashboard</h1>
        </div>

        <section>
          <h2 className="mb-4 text-xl font-semibold">My cards</h2>
          {owned.length === 0 ? (
            <div className="card-surface rounded-xl p-8 text-center">
              <p className="text-muted-foreground">No delivered cards yet.</p>
              <Button variant="neon" className="mt-4" asChild><Link to="/shop">Shop cards</Link></Button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {owned.map((o) => (
                <div key={o.id} className="card-surface space-y-3 rounded-xl p-4">
                  {o.cards && <CardVisual card={o.cards} />}
                  <p className="font-semibold">{o.cards?.card_name ?? "Card"}</p>
                  <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs text-primary">{o.delivery_details || "Details will appear here."}</pre>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold">Order history</h2>
          <div className="card-surface overflow-x-auto rounded-xl">
            <table className="w-full text-sm">
              <thead className="font-mono text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">{["Date", "Card", "Amount", "Method", "Tx hash", "Status"].map((h) => <th key={h} className="p-3 text-left">{h}</th>)}</tr>
              </thead>
              <tbody>
                {isLoading && <tr><td className="p-3 text-muted-foreground" colSpan={6}>loading…</td></tr>}
                {!isLoading && orders.length === 0 && <tr><td className="p-3 text-muted-foreground" colSpan={6}>No orders yet.</td></tr>}
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-border/50">
                    <td className="p-3">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td className="p-3">{o.cards?.card_name ?? "—"}</td>
                    <td className="p-3 font-mono">${Number(o.amount_usd ?? 0).toFixed(2)}</td>
                    <td className="p-3 font-mono">{paymentMethodLabel(o.crypto_method)}</td>
                    <td className="max-w-[160px] truncate p-3 font-mono text-xs">{o.txid ?? "Not submitted"}</td>
                    <td className="p-3"><StatusBadge status={o.status} txid={o.txid} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Layout>
  );
}
