import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/verify-payments")({
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const body = z.object({ kind: z.literal("verify-payments") }).safeParse(await request.json().catch(() => null));
    if (!body.success) return Response.json({ error: "Invalid request" }, { status: 400 });
    const { verifyPendingPayments } = await import("@/lib/crypto-verifier.server");
    return Response.json(await verifyPendingPayments());
  } } },
});