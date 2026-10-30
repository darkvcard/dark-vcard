import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Send, MessageCircle, ShieldCheck } from "lucide-react";
import { Brand } from "./Brand";
import { NavAuthSkeleton, NavLinkSkeleton } from "./LoadingSkeletons";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const TELEGRAM_URL = "https://t.me/vcardbond";
export const DISCORD_URL = "https://discord.gg/vcardbond";

function Header() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };
  const link = "font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-primary";
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Brand />
        <nav className="hidden items-center gap-6 md:flex">
          <Link to="/" className={link} activeOptions={{ exact: true }} activeProps={{ className: "text-primary" }}>Home</Link>
          <Link to="/shop" className={link} activeProps={{ className: "text-primary" }}>Shop</Link>
          {/* Reserve the link slot while the session resolves so nothing pops in. */}
          {loading ? <NavLinkSkeleton /> : user && <Link to="/dashboard" className={link} activeProps={{ className: "text-primary" }}>Dashboard</Link>}
          {/* Only rendered once the role lookup says this account is an admin. */}
          {!loading && isAdmin && <Link to="/admin" className={link} activeProps={{ className: "text-primary" }}>Admin</Link>}
        </nav>
        <div className="flex items-center gap-2">
          {loading ? (
            <NavAuthSkeleton />
          ) : user ? (
            <Button variant="terminal" size="sm" onClick={signOut}>Sign out</Button>
          ) : (
            <Button variant="neon" size="sm" asChild><Link to="/auth">Sign in</Link></Button>
          )}
        </div>
      </div>
      <div className="flex justify-center gap-5 pb-2 md:hidden">
        <Link to="/shop" className={link}>Shop</Link>
        {loading ? <NavLinkSkeleton /> : user && <Link to="/dashboard" className={link}>Dashboard</Link>}
        {!loading && isAdmin && <Link to="/admin" className={link}>Admin</Link>}
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-3">
        <div className="space-y-3">
          <Brand src="/logo-trans.png" />
          <p className="text-sm text-muted-foreground">Privacy-first prepaid virtual cards, paid with crypto. vcard.bond</p>
        </div>
        <div className="space-y-2 font-mono text-sm">
          <p className="text-xs uppercase tracking-widest text-primary">// navigate</p>
          <Link to="/shop" className="block text-muted-foreground hover:text-foreground">Shop cards</Link>
          <Link to="/dashboard" className="block text-muted-foreground hover:text-foreground">My orders</Link>
          <Link to="/auth" className="block text-muted-foreground hover:text-foreground">Account</Link>
        </div>
        <div className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">// 24/7 support</p>
          <div className="flex gap-3">
            <Button variant="terminal" size="sm" asChild>
              <a href={TELEGRAM_URL} target="_blank" rel="noreferrer"><Send /> Telegram</a>
            </Button>
            <Button variant="terminal" size="sm" asChild>
              <a href={DISCORD_URL} target="_blank" rel="noreferrer"><MessageCircle /> Discord</a>
            </Button>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-success" /> Payments verified on-chain</p>
        </div>
      </div>
      <p className="border-t border-border/60 py-4 text-center font-mono text-xs text-muted-foreground">© {new Date().getFullYear()} vCARD — all systems operational</p>
    </footer>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
