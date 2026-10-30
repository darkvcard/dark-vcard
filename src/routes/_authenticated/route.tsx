import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/site/LoadingSkeletons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingComponent: PageSkeleton,
  beforeLoad: async () => {
    // Read the stored session (auto-refreshed by supabase-js) instead of making a
    // blocking network call on every navigation: the guard stays instant, so the
    // page transition never stalls on the previous screen.
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
