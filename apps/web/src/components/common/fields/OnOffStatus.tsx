import { forwardRef, type ComponentProps } from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

// The read-only state of a switch the reader may not change: one icon and one wording
// for on and off everywhere, in place of a disabled control (apps/web/AGENTS.md).
// forwardRef + spread so it works as a Radix Tooltip `asChild` trigger.
const OnOffStatus = forwardRef<HTMLSpanElement, ComponentProps<'span'> & { on: boolean }>(
  ({ on, className, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn('flex items-center gap-1.5 text-sm text-muted-foreground', className)}
      {...props}
    >
      {on ? <Check className="size-4 text-green-500" /> : <Minus className="size-4" />}
      {children}
    </span>
  ),
);
OnOffStatus.displayName = 'OnOffStatus';

export default OnOffStatus;
