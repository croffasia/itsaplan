import type { ComponentProps, ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// A row of the rail's sort and filter popover. `inset` lines a choice up under its filter.
export default function DocumentsRailMenuButton({
  icon,
  checked = false,
  inset = false,
  trailing,
  className,
  children,
  ...props
}: ComponentProps<'button'> & {
  icon?: ReactNode;
  checked?: boolean;
  inset?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-start text-sm transition-colors outline-none hover:bg-accent focus-visible:bg-accent [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground',
        inset && 'ps-8.5',
        className,
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
      {checked && <Check />}
    </button>
  );
}
