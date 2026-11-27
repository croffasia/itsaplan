import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// The heading of one group of properties, spanning both columns of the Properties
// grid. Given onToggle, the whole row toggles the group; without it, it only names it.
export default function IssuePropertyGroupHeading({
  label,
  open = true,
  onToggle,
  className,
}: {
  label: string;
  open?: boolean;
  onToggle?: () => void;
  className?: string;
}) {
  if (!onToggle) {
    return (
      <div
        className={cn('col-span-2 flex items-center gap-1.5 text-muted-foreground/70', className)}
      >
        <span className="h-px flex-1 bg-border/60" />
        <span className="text-[10px] font-semibold tracking-wide uppercase">{label}</span>
      </div>
    );
  }

  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <button
      type="button"
      className={cn(
        'col-span-2 flex items-center gap-1.5 text-muted-foreground/70 hover:text-foreground',
        className,
      )}
      onClick={onToggle}
    >
      <span className="h-px flex-1 bg-border/60" />
      <span className="text-[10px] font-semibold tracking-wide uppercase">{label}</span>
      <Chevron className="size-3" />
    </button>
  );
}
