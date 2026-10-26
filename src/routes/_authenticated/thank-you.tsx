import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Layout } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/thank-you")({
  head: () => ({ meta: [{ title: "Payment Under Review — vCard" }, { name: "description", content: "Your crypto payment proof was received and is being reviewed." }, { property: "og:title", content: "Payment Under Review — vCard" }, { property: "og:description", content: "Your crypto payment proof was received and is being reviewed." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: ThankYou,
});

function ThankYou() {
  return (
    <Layout>
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <CheckCircle2 className="mx-auto size-12 text-primary" />
        <h1 className="mt-6 text-3xl font-bold">Thank you!</h1>
        <p className="mt-4 text-muted-foreground">Your payment is under review. Once the admin verifies your TXID, your card details will be available in your dashboard.</p>
        <Button variant="neon" className="mt-8" asChild><Link to="/dashboard">Go to dashboard</Link></Button>
      </div>
    </Layout>
  );
}
