import { Skeleton } from '@/components/ui/skeleton';

/** Dim FeedCard layout skeleton (media block unchanged in real cards). */
export const FeedItemSkeleton = () => (
  <div className="feed-card border-b border-border px-[22px] py-[18px]">
    <div className="mb-2.5 flex items-center gap-[11px]">
      <Skeleton className="h-[46px] w-[46px] shrink-0 rounded-full bg-muted" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-40 rounded bg-muted" />
        <Skeleton className="h-3 w-28 rounded bg-muted" />
      </div>
    </div>
    <Skeleton className="mb-3 h-4 w-full rounded bg-muted" />
    <Skeleton className="mb-3 h-4 w-5/6 rounded bg-muted" />
    <Skeleton className="h-48 w-full rounded-2xl bg-muted" />
    <div className="-ml-2.5 mt-3 flex items-center gap-2">
      <Skeleton className="h-9 w-14 rounded-[10px] bg-muted" />
      <Skeleton className="h-9 w-14 rounded-[10px] bg-muted" />
      <Skeleton className="h-[34px] w-16 rounded-full bg-muted" />
      <div className="flex-1" />
      <Skeleton className="h-9 w-9 rounded-[10px] bg-muted" />
      <Skeleton className="h-9 w-9 rounded-[10px] bg-muted" />
    </div>
  </div>
);
