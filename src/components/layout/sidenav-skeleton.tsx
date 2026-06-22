import { Skeleton } from '@/components/ui/skeleton';

export const SideNavSkeleton = () => (
  <div className="app-nav hidden h-full max-h-full w-[var(--app-nav-width)] shrink-0 min-h-0 flex-col overflow-hidden border-r border-border bg-background md:flex">
    {/* Wordmark placeholder */}
    <div className="flex items-center gap-2.5 px-5 pt-5 pb-3 shrink-0">
      <Skeleton className="h-8 w-8 rounded-[9px]" />
      <Skeleton className="h-5 w-24" />
    </div>
    {/* User card placeholder */}
    <div className="px-3 shrink-0">
      <div className="flex items-center gap-3 px-2 py-2.5">
        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
    {/* Credits chip placeholder */}
    <div className="px-3 mt-2 mb-1 shrink-0">
      <Skeleton className="h-12 w-full rounded-[14px]" />
    </div>
    {/* Nav items */}
    <div className="flex-1 px-3 py-1">
      <div className="space-y-1 pt-2">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-xl" />
        ))}
      </div>
    </div>
    {/* Bottom bar */}
    <div className="shrink-0 border-t border-border/60 p-3 pt-3">
      <Skeleton className="h-11 w-full rounded-full" />
    </div>
  </div>
);
