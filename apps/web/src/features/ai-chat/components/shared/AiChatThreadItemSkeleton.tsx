import { Skeleton } from '@/components/ui/skeleton';

// Stands in for one conversation in the thread list: its title and the time under it.
export function AiChatThreadItemSkeleton() {
  return (
    <div className="flex items-start gap-2 px-1.5 py-2">
      <Skeleton className="mt-0.5 size-3.5 shrink-0 rounded" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-4/5 rounded" />
        <Skeleton className="h-3 w-12 rounded" />
      </div>
    </div>
  );
}
