import { Skeleton } from '@/components/ui/skeleton';

export default function AgentsPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[390px] w-full rounded-2xl lg:h-[340px]" />
      <div className="flex justify-between gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-72" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-64 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
