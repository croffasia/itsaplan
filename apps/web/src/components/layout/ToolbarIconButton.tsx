import type { ComponentProps } from 'react';
import { useIconHover } from '@animateicons/react';
import { cn } from '@/lib/utils';
import type { AnimatedIcon } from '@/lib/animatedIcon';

// Spreads the rest of its props on the button, so a Radix trigger can render it
// through `asChild`.
export default function ToolbarIconButton({
  icon: Icon,
  active = false,
  className,
  ...props
}: ComponentProps<'button'> & { icon: AnimatedIcon; active?: boolean }) {
  const { ref, triggerProps } = useIconHover();
  return (
    <button
      type="button"
      {...props}
      {...triggerProps}
      className={cn(
        'flex rounded-md p-1.5 hover:bg-accent hover:text-foreground',
        active ? 'bg-accent text-foreground' : 'text-muted-foreground',
        className,
      )}
    >
      <Icon ref={ref} size={16} />
    </button>
  );
}
