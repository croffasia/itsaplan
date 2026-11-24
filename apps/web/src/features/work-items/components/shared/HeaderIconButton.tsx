import { useIconHover } from '@animateicons/react';
import type { AnimatedIcon } from '@/lib/animatedIcon';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// An icon action in a column or group header. `label` is its tooltip and its
// accessible name.
export function HeaderIconButton({
  icon: Icon,
  label,
  onClick,
  className,
}: {
  icon: AnimatedIcon;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  const { ref, triggerProps } = useIconHover();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('size-6 text-muted-foreground', className)}
          {...triggerProps}
          onClick={onClick}
          aria-label={label}
        >
          <Icon ref={ref} size={16} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
