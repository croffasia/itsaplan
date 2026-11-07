import { useIconHover } from '@animateicons/react';
import { CheckIcon } from '@animateicons/react/lucide/check-icon';
import { cn } from '@/lib/utils';
import type { AnimatedIcon } from '@/lib/animatedIcon';

export default function PropertyChip({
  label,
  on,
  onClick,
  icon: Icon = CheckIcon,
  iconClassName,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  // Shown before the label of a chip that is on.
  icon?: AnimatedIcon;
  iconClassName?: string;
}) {
  const { ref, triggerProps } = useIconHover();
  return (
    <button
      {...triggerProps}
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs transition-colors',
        on
          ? 'bg-secondary ps-1.5 font-medium text-foreground hover:bg-accent'
          : 'text-muted-foreground ring-1 ring-border ring-inset hover:bg-accent hover:text-foreground',
      )}
    >
      {on && <Icon ref={ref} size={12} className={iconClassName} />}
      {label}
    </button>
  );
}
