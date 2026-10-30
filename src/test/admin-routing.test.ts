import { createRouter, isRedirect, rootRouteId } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { Route as AdminOrdersRoute } from "@/routes/admin.orders";

describe("Admin routing", () => {
  it("serves the admin console at /admin", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    expect(router.matchRoutes("/admin").at(-1)?.routeId).toBe("/_authenticated/admin");
  });

  it("matches /admin/orders so the legacy URL can redirect instead of 404ing", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/admin/orders");

    expect(matches.at(-1)?.routeId).toBe("/admin/orders");
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("redirects /admin/orders to the working /admin route", () => {
    const beforeLoad = AdminOrdersRoute.options.beforeLoad as unknown as () => unknown;
    let thrown: unknown;
    try {
      beforeLoad();
    } catch (error) {
      thrown = error;
    }

    expect(isRedirect(thrown)).toBe(true);
    expect((thrown as Response & { options: { to: string } }).options.to).toBe("/admin");
  });
});

