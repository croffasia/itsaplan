import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Shaped like a Card, but the whole surface is the button, so it cannot wrap one.
export default function BraindumpDestinationCard({
  icon: Icon,
  label,
  target,
  hint,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  target: string;
  hint?: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={hint}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left text-card-foreground shadow-sm',
        'transition-colors hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{target}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
