'use client';

import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const ROW_GRID = 'grid min-w-[900px] grid-cols-[16%_20%_28%_18%_18%] border-b';

const COLUMNS = ['time', 'actor', 'action', 'where', 'from'] as const;

const ROWS = [
  ['70%', '55%', '80%', '60%', '50%'],
  ['65%', '70%', '60%', '45%', '55%'],
  ['70%', '50%', '90%', '70%', '45%'],
  ['60%', '65%', '55%', '50%', '60%'],
  ['70%', '45%', '75%', '65%', '50%'],
  ['65%', '60%', '65%', '40%', '55%'],
  ['70%', '55%', '85%', '55%', '45%'],
  ['60%', '70%', '50%', '60%', '60%'],
];

// The audit log of a workspace and of the instance: the search, the period, the export
// and the table of events.
export default function AuditLogPreview() {
  const t = useTranslations('sections.previews.auditLog');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 min-w-64 flex-1" />
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="overflow-hidden">
        <div className={cn(ROW_GRID, 'py-2 text-xs font-medium text-muted-foreground')}>
          {COLUMNS.map((column) => (
            <span key={column} className="px-3">
              {t(`columns.${column}`)}
            </span>
          ))}
        </div>
        {ROWS.map((widths, row) => (
          <div key={row} className={cn(ROW_GRID, 'py-3')}>
            {widths.map((width, cell) => (
              <div key={cell} className="space-y-1.5 px-3">
                <Skeleton className="h-3.5" style={{ width }} />
                {cell === 1 && <Skeleton className="h-2.5 w-2/5" />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
