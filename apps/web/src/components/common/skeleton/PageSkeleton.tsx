import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import ListSkeleton from './ListSkeleton';

// Stands in for a whole page body while it loads: the header block over a list. The
// scroll container, the column and the header spacing match SectionPageView and
// PageHeader, so the loaded page lands where the skeleton was. `className` styles the
// column (its width and padding).
export default function PageSkeleton({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className="flex-1 overflow-y-auto" aria-busy>
      <div className={cn('mx-auto flex w-full max-w-4xl flex-col px-8 py-10', className)}>
        <header className="mb-8 flex flex-col gap-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-full max-w-md" />
        </header>
        <ListSkeleton rows={rows} />
      </div>
    </div>
  );
}
