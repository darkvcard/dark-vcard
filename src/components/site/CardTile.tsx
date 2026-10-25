import { Cpu, Wifi } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";

export type CardRow = Tables<"cards">;

export const stockLabel: Record<CardRow["stock_status"], string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Sold out",
};

export function CardVisual({ card }: { card: CardRow }) {
  if (card.image_url)
    return <img src={card.image_url} alt={card.card_name} className="aspect-[1.6] w-full rounded-lg object-cover" />;
  return (
    <div className="relative aspect-[1.6] w-full overflow-hidden rounded-lg border border-cobalt/60 bg-gradient-to-br from-cobalt via-secondary to-background p-4">
      <div className="absolute inset-0 scanlines opacity-60" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex justify-between">
          <span className="font-mono text-xs font-bold tracking-wider"><span className="text-neon">{"{"}</span>vCARD<span className="text-neon">{"}"}</span></span>
          <Wifi className="h-4 w-4 rotate-90 text-muted-foreground" />
        </div>
        <Cpu className="h-8 w-8 text-primary" />
        <div className="flex items-end justify-between font-mono">
          <span className="text-sm tracking-[0.2em] text-muted-foreground">•••• •••• •••• ••••</span>
          <span className="text-xs font-bold uppercase">{card.card_type}</span>
        </div>
      </div>
    </div>
  );
}

export function CardTile({ card, onBuy }: { card: CardRow; onBuy?: (c: CardRow) => void }) {
  const out = card.stock_status === "out_of_stock";
  return (
    <div className="group card-surface flex flex-col gap-4 rounded-xl p-4 transition hover:border-primary/60 hover:shadow-neon">
      <CardVisual card={card} />
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{card.card_name}</h3>
          <p className="font-mono text-xs uppercase text-muted-foreground">{card.card_type}</p>
        </div>
        <Badge variant={out ? "destructive" : "secondary"} className="font-mono text-[10px] uppercase">{stockLabel[card.stock_status]}</Badge>
      </div>
      {card.description && <p className="line-clamp-2 text-sm text-muted-foreground">{card.description}</p>}
      <div className="mt-auto flex items-center justify-between">
        <span className="font-mono text-2xl font-bold text-neon">${Number(card.price_in_usd).toFixed(2)}</span>
        {onBuy && (
          <button
            disabled={out}
            onClick={() => onBuy(card)}
            className="rounded-md bg-primary px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-neon transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {out ? "Sold out" : "Buy now"}
          </button>
        )}
      </div>
    </div>
  );
}
