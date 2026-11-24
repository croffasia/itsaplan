import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// A spinner with how many of something work; nothing while none does. `label` is what a
// screen reader says for it.
export default function WorkingCount({
  count,
  label,
  className,
}: {
  count: number;
  label: string;
  className?: string;
}) {
  if (count === 0) return null;
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-xs font-semibold tabular-nums', className)}
    >
      <LoaderCircle
        aria-hidden
        className="size-3.5 animate-spin text-current motion-reduce:animate-none"
      />
      <span aria-hidden>{count}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
