import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';

export default function DocumentsHomeLoading() {
  const t = useTranslations('documents');

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t('home.loading')}
      className="flex flex-col gap-10 max-md:gap-8"
    >
      <div>
        <Skeleton className="mb-2.5 h-7.5 w-30 bg-muted" />
        <Skeleton className="h-4 w-45 bg-muted" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4">
        {[1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-49 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {[1, 2, 3, 4, 5].map((key) => (
          <Skeleton key={key} className="h-8 bg-muted" />
        ))}
      </div>
    </div>
  );
}
