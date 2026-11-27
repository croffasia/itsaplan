import { type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// The heading row of a section of the issue detail: the toggle with a chevron and the
// label, anything that belongs next to the label, and the section's actions at the end.
export default function IssueSectionHeading({
  label,
  open,
  onToggle,
  tally,
  beside,
  actions,
  className,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  // Free text shown after the label (the Subtasks section counts the done ones).
  tally?: string;
  beside?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div
      className={cn('flex min-h-7 items-center justify-between gap-3', open && 'mb-2', className)}
    >
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          className="flex items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground/70 uppercase hover:text-foreground"
          onClick={onToggle}
        >
          <Chevron className="size-3.5" />
          {label}
          {tally && <span className="tabular-nums">{tally}</span>}
        </button>
        {beside}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}
