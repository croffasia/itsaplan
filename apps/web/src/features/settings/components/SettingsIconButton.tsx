'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// A row action in the settings tables: an icon with its label in a tooltip. The
// larger tap target below the sm breakpoint is for touch.
export default function SettingsIconButton({
  title,
  destructive,
  onClick,
  children,
}: {
  title: string;
  destructive?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'size-11 text-muted-foreground sm:size-8',
            destructive ? 'hover:text-destructive' : 'hover:text-foreground',
          )}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}
