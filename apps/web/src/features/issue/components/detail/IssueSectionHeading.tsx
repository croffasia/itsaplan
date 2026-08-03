import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// The heading of a collapsible section of the issue detail (Properties,
// Attachments, Links, Stats): a chevron and the label, the whole row toggling the
// section.
export default function IssueSectionHeading({
  label,
  open,
  onToggle,
  tally,
  className,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  // Free text shown after the label (the Subtasks section counts the done ones).
  tally?: string;
  className?: string;
}) {
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <button
      type="button"
      className={cn(
        'flex items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground',
        className,
      )}
      onClick={onToggle}
    >
      <Chevron className="size-3.5" />
      {label}
      {tally && <span className="tabular-nums">{tally}</span>}
    </button>
  );
}
