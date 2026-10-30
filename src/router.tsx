import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/site/LoadingSkeletons";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Show a skeleton as soon as a navigation starts instead of leaving the
    // previous page on screen while the next route resolves. No minimum display
    // time: fast transitions shouldn't get an artificial flash of skeleton.
    defaultPendingComponent: PageSkeleton,
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  });

  return router;
};

