import { Fragment, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// A group of label and value rows in the Properties grid, under a divider that folds it.
export default function DocumentDetailsGroup({
  label,
  rows,
  open,
  spaced = false,
  onToggle,
}: {
  label: string;
  rows: [string, ReactNode][];
  open: boolean;
  spaced?: boolean;
  onToggle: () => void;
}) {
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        className={cn(
          'col-span-2 flex items-center gap-1.5 text-muted-foreground/70 transition-colors hover:text-foreground',
          spaced && 'mt-2',
        )}
        onClick={onToggle}
      >
        <span className="h-px flex-1 bg-border/60" />
        <span className="text-[10px] font-semibold tracking-wider uppercase">{label}</span>
        <Chevron className="size-3" />
      </button>
      {open &&
        rows.map(([rowLabel, value]) => (
          <Fragment key={rowLabel}>
            <div className="truncate pt-1.5 text-muted-foreground" title={rowLabel}>
              {rowLabel}
            </div>
            <div className="min-w-0">{value}</div>
          </Fragment>
        ))}
    </>
  );
}
