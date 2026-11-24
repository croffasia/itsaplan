import { Skeleton } from '@/components/ui/skeleton';

// Stands in for one conversation of the list: its agent, its title and the line under it.
export function ChatPanelListSkeleton() {
  return (
    <div className="flex items-center gap-3 p-2">
      <Skeleton className="size-8 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-4/5 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
      </div>
    </div>
  );
}
