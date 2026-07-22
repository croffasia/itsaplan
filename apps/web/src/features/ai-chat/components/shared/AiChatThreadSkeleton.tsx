'use client';

import { Skeleton } from '@/components/ui/skeleton';

// Shown while a past thread's transcript loads.
export function AiChatThreadSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4" aria-busy>
      <div className="flex justify-end">
        <Skeleton className="h-8 w-40 rounded-2xl" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-11/12 rounded" />
        <Skeleton className="h-4 w-4/5 rounded" />
        <Skeleton className="h-4 w-2/3 rounded" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-8 w-56 rounded-2xl" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-10/12 rounded" />
        <Skeleton className="h-4 w-3/4 rounded" />
      </div>
    </div>
  );
}
