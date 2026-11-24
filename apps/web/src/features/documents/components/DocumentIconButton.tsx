import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// A square ghost button of the page chrome. Its label is both the accessible name and
// the tooltip.
export default function DocumentIconButton({
  label,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, 'variant' | 'size'> & { label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      title={label}
      className={cn(
        "text-muted-foreground hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground aria-pressed:bg-accent aria-pressed:text-foreground [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}
