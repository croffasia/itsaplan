import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// A formatting button of the page toolbar. `active` marks a toggle that is on; a menu
// trigger passes its props through, so it can sit inside a Popover or DropdownMenu trigger.
export default function DocumentToolbarButton({
  label,
  active,
  className,
  children,
  ...props
}: ComponentProps<'button'> & { label: string; active?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          // Keeps the text selection the button acts on.
          onMouseDown={(event) => event.preventDefault()}
          {...props}
          className={cn(
            'relative grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 aria-expanded:bg-accent aria-expanded:text-foreground aria-pressed:bg-accent aria-pressed:text-foreground [&_svg]:size-4 [&_svg]:stroke-[1.75]',
            className,
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
