import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy admin URL. The admin console lives at /admin, so keep
// /admin/orders working as a redirect instead of returning a 404.
export const Route = createFileRoute("/admin/orders")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", replace: true });
  },
  component: () => null,
});
