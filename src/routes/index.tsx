import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EyeOff, Zap, Bitcoin, ShieldCheck, Globe, Headphones } from "lucide-react";
import { Layout } from "@/components/site/Layout";
import { CardTile, type CardRow } from "@/components/site/CardTile";
import { CheckoutDialog } from "@/components/site/CheckoutDialog";
import { Button } from "@/components/ui/button";
import { cardsQuery } from "@/lib/cards";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "vCard — Buy Virtual Debit Cards Anonymously with Crypto" },
      { name: "description", content: "Privacy-first prepaid virtual Visa & Mastercard cards. Pay with BTC, ETH, USDT. Fast delivery, 24/7 support." },
      { property: "og:title", content: "vCard — Buy Virtual Cards Anonymously" },
      { property: "og:description", content: "Prepaid virtual debit cards paid with crypto. Instant, private, trusted." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const features = [
  { icon: EyeOff, title: "No KYC hassle", text: "Buy with just an email. Your privacy stays yours." },
  { icon: Bitcoin, title: "Crypto native", text: "BTC, ETH, USDT and LTC accepted out of the box." },
  { icon: Zap, title: "Fast delivery", text: "Cards land in your dashboard once payment confirms." },
  { icon: ShieldCheck, title: "On-chain verified", text: "Every order is matched to a real transaction hash." },
  { icon: Globe, title: "Works worldwide", text: "Use for subscriptions, ads, SaaS and online shopping." },
  { icon: Headphones, title: "24/7 support", text: "Real humans on Telegram and Discord, any time." },
];

function Index() {
  const { data: cards = [] } = useQuery(cardsQuery);
  const [buying, setBuying] = useState<CardRow | null>(null);
  const featured = cards.filter((c) => c.stock_status !== "out_of_stock").slice(0, 3);

  return (
    <Layout>
      <section className="relative overflow-hidden">
        <img src={hero} alt="" width={1536} height={1024} className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30" />
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 md:py-36">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">&gt; root@vcard.bond:~$ ./connect --secure<span className="caret">_</span></p>
          <h1 className="mt-6 max-w-3xl text-5xl font-bold leading-[1.05] md:text-7xl">
            Buy Virtual Cards <span className="text-neon">Anonymously</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Prepaid virtual Visa & Mastercard debit cards, paid in crypto. No paperwork, no tracking — just a card that works.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Button variant="neon" size="lg" asChild><Link to="/shop">Browse cards</Link></Button>
            <Button variant="terminal" size="lg" asChild><Link to="/auth">Create account</Link></Button>
          </div>
          <div className="mt-14 flex flex-wrap gap-8 font-mono text-sm">
            {[["12k+", "cards delivered"], ["4", "cryptos accepted"], ["<15m", "avg. delivery"]].map(([n, l]) => (
              <div key={l}><p className="text-2xl font-bold text-neon">{n}</p><p className="text-xs uppercase text-muted-foreground">{l}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-primary">// featured</p>
            <h2 className="mt-2 text-3xl font-bold">Hot cards today</h2>
          </div>
          <Link to="/shop" className="font-mono text-sm text-primary hover:underline">view all →</Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((c) => <CardTile key={c.id} card={c} onBuy={setBuying} />)}
        </div>
      </section>

      <section className="border-y border-border/60 bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-20">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">// why_choose_us</p>
          <h2 className="mt-2 text-3xl font-bold">Built for crypto people</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="card-surface rounded-xl p-6">
                <f.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <CheckoutDialog card={buying} onClose={() => setBuying(null)} />
    </Layout>
  );
}
