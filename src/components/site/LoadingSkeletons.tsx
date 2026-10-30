import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading placeholders.
 *
 * They keep the page frame (and its height) stable while auth/data resolve, so
 * navigation shows a skeleton instead of the previous page, a blank screen or a
 * flash of the signed-out UI.
 */

/** Full-page skeleton rendered by the router while a route is loading. */
export function PageSkeleton({ label = "Loading page" }: { label?: string }) {
  return (
    <div className="min-h-screen bg-background" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}…</span>
      <div className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Skeleton className="h-7 w-28" />
          <div className="hidden gap-6 md:flex">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-12">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-9 w-64" />
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl border border-border/60" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Skeleton for a page section behind the site chrome (dashboard, admin, auth). */
export function SectionSkeleton({ rows = 3, label = "Loading content", className }: { rows?: number; label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={cn("space-y-6", className)}>
      <span className="sr-only">{label}…</span>
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-9 w-64" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl border border-border/60" />
        ))}
      </div>
    </div>
  );
}

/** Occupies the navbar auth slot while the session is being read. */
export function NavAuthSkeleton() {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

/** Occupies a navbar link slot so links don't pop in and shift the layout. */
export function NavLinkSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-3 w-16", className)} aria-hidden="true" />;
}
