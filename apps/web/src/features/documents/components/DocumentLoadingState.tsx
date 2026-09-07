import { Skeleton } from '@/components/ui/skeleton';

export default function DocumentLoadingState() {
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <div className="h-12 border-b px-4 py-4">
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="h-11 border-b px-4 py-2">
        <Skeleton className="h-7 w-80 max-w-full" />
      </div>
      <div className="mx-auto w-full max-w-[800px] px-6 py-12 md:px-12">
        <Skeleton className="mb-4 size-10 rounded-lg" />
        <Skeleton className="h-11 w-2/3 max-w-xl" />
        <Skeleton className="mt-4 h-3 w-48" />
        <Skeleton className="mt-10 h-72 w-full" />
      </div>
    </main>
  );
}
