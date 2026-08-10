import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Skeleton } from '@/components/ui/skeleton';

// Stands in for the body of an issue while it loads: the title, the description and
// the properties under it.
export default function IssueDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6 py-6" aria-busy>
      <Skeleton className="h-7 w-2/3 max-w-lg" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <ListSkeleton rows={4} rowClassName="h-8" />
    </div>
  );
}
