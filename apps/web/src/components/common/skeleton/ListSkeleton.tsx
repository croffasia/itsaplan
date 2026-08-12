import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslations } from 'next-intl';

// Stands in for a list, a table or a feed while its query loads: one bar per row.
// `className` styles the stack (its padding inside the surrounding container),
// `rowClassName` the bars (a taller or narrower row). The bars carry no text, so the
// stack is a live region with a label of its own: that is what a screen reader reads
// while the query runs.
export default function ListSkeleton({
  rows = 4,
  className,
  rowClassName,
}: {
  rows?: number;
  className?: string;
  rowClassName?: string;
}) {
  const t = useTranslations('common');
  return (
    <div className={cn('flex flex-col gap-2', className)} role="status" aria-busy>
      <span className="sr-only">{t('loading')}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn('h-10 w-full', rowClassName)} />
      ))}
    </div>
  );
}
