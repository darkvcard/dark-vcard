import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Layout } from "@/components/site/Layout";
import { CardTile, type CardRow } from "@/components/site/CardTile";
import { CheckoutDialog } from "@/components/site/CheckoutDialog";
import { cardsQuery } from "@/lib/cards";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop Virtual Cards — vCard" },
      { name: "description", content: "Browse prepaid virtual Visa, Mastercard and Amex cards available for crypto today." },
      { property: "og:title", content: "Shop Virtual Cards — vCard" },
      { property: "og:description", content: "Live inventory of prepaid virtual debit cards, paid with crypto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Shop,
});

function Shop() {
  const { data: cards = [], isLoading } = useQuery(cardsQuery);
  const [filter, setFilter] = useState("All");
  const [buying, setBuying] = useState<CardRow | null>(null);
  const types = ["All", ...Array.from(new Set(cards.map((c) => c.card_type)))];
  const shown = filter === "All" ? cards : cards.filter((c) => c.card_type === filter);

  return (
    <Layout>
      <section className="relative border-b border-border/60">
        <div className="absolute inset-0 glow-radial" />
        <div className="relative mx-auto max-w-7xl px-4 py-14">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">// inventory</p>
          <h1 className="mt-2 text-4xl font-bold">Available cards</h1>
          <div className="mt-6 flex flex-wrap gap-2">
            {types.map((t) => (
              <button key={t} onClick={() => setFilter(t)}
                className={`rounded-md border px-3 py-1.5 font-mono text-xs uppercase ${filter === t ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/60"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-12">
        {isLoading ? <p className="font-mono text-muted-foreground">loading inventory…</p> : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((c) => <CardTile key={c.id} card={c} onBuy={setBuying} />)}
          </div>
        )}
      </section>
      <CheckoutDialog card={buying} onClose={() => setBuying(null)} />
    </Layout>
  );
}
