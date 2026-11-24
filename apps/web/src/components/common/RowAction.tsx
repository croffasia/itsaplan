'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// An icon button for a row's or a section header's actions. The label is both the
// tooltip and the accessible name, so the button carries no visible text.
export default function RowAction({
  icon: Icon,
  label,
  destructive,
  className,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  destructive?: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'size-8 text-muted-foreground',
            destructive ? 'hover:text-destructive' : 'hover:text-foreground',
            className,
          )}
          aria-label={label}
          onClick={onClick}
        >
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
