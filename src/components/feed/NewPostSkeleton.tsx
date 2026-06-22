import { Skeleton } from '@/components/ui/skeleton';

/** Dim home feed composer skeleton */
export function NewPostSkeleton({ variant = 'feed' }: { variant?: 'feed' | 'default' }) {
  if (variant === 'default') {
    return (
      <div className="flex animate-pulse items-start gap-4 rounded-xl bg-background p-4">
        <Skeleton className="h-10 w-10 rounded-full bg-muted" />
        <div className="flex flex-1 flex-col gap-4">
          <Skeleton className="h-12 w-full rounded-md bg-muted" />
          <div className="mt-2 flex items-center justify-between">
            <div className="flex gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-7 rounded-md bg-muted" />
              ))}
            </div>
            <Skeleton className="h-10 w-28 rounded-full bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex animate-pulse gap-3 px-[22px] py-[18px]">
      <Skeleton className="h-11 w-11 shrink-0 rounded-full bg-muted" />
      <div className="flex flex-1 flex-col gap-3">
        <Skeleton className="h-6 w-full max-w-md rounded bg-muted" />
        <div className="flex items-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[38px] w-[38px] rounded-[11px] bg-muted" />
          ))}
          <div className="flex-1" />
          <Skeleton className="h-8 w-40 rounded-full bg-muted" />
          <Skeleton className="h-10 w-20 rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}
