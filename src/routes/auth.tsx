import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Layout } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — vCard" },
      { name: "description", content: "Access your vCard account to buy cards and track orders." },
      { property: "og:title", content: "Sign in — vCard" },
      { property: "og:description", content: "Access your vCard account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({ email: z.string().trim().email().max(255), password: z.string().min(8, "Password must be at least 8 characters").max(72) });

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { if (user) navigate({ to: "/dashboard" }); }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = schema.safeParse({ email, password });
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Invalid input"); return; }
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword(p.data);
      if (error) toast.error(error.message);
      else navigate({ to: "/dashboard" });
    } else {
      const { data, error } = await supabase.auth.signUp(p.data);
      if (error) toast.error(error.message);
      else if (data.session) navigate({ to: "/dashboard" });
      else {
        const r = await supabase.auth.signInWithPassword(p.data);
        if (r.error) toast.error(r.error.message);
        else navigate({ to: "/dashboard" });
      }
    }
    setBusy(false);
  };

  return (
    <Layout>
      <div className="relative grid min-h-[70vh] place-items-center px-4 py-16">
        <div className="absolute inset-0 grid-bg opacity-20" />
        <div className="relative w-full max-w-md card-surface rounded-xl p-8 shadow-neon">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">&gt; {mode === "in" ? "authenticate" : "register"}</p>
          <h1 className="mt-2 text-2xl font-bold">{mode === "in" ? "Welcome back" : "Create your account"}</h1>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <Button variant="neon" className="w-full" disabled={busy}>{mode === "in" ? "Sign in" : "Sign up"}</Button>
          </form>
          <button className="mt-6 w-full font-mono text-xs text-muted-foreground hover:text-primary" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "No account? sign_up" : "Have an account? sign_in"}
          </button>
        </div>
      </div>
    </Layout>
  );
}
