import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function DocumentToolbarButton({
  label,
  active = false,
  disabled = false,
  onPress,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={label}
          aria-pressed={active}
          className={cn(
            'relative grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-[background-color,color,transform] duration-150 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background active:scale-[0.96] disabled:pointer-events-none disabled:opacity-30 [&_svg]:size-4 [&_svg]:stroke-[1.75]',
            active &&
              'bg-primary/10 text-primary after:absolute after:inset-x-2 after:bottom-0.5 after:h-px after:rounded-full after:bg-primary/70 hover:bg-primary/15 hover:text-primary',
          )}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onPress}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
