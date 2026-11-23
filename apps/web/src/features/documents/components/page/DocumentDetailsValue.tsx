import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// The value cell of a page property: a button where the user may change it, plain
// text where they may not.
export default function DocumentDetailsValue({
  interactive,
  className,
  children,
  ...props
}: ComponentProps<'button'> & { interactive: boolean }) {
  const classes = cn(
    '-ms-2 flex h-8 w-full items-center gap-2 overflow-hidden rounded-md px-2 text-start whitespace-nowrap [&>svg]:size-3.5 [&>svg]:shrink-0 [&>svg]:text-muted-foreground',
    interactive && 'transition-colors hover:bg-accent',
    className,
  );
  if (!interactive) return <span className={classes}>{children}</span>;
  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}
