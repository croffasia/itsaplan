import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// A description cut to two lines. The tooltip with the whole text opens only when the
// cut hides part of it.
export function ClampedDescription({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <Tooltip
      open={open}
      onOpenChange={(next) => {
        const el = ref.current;
        setOpen(next && el !== null && el.scrollHeight > el.clientHeight);
      }}
    >
      <TooltipTrigger asChild>
        <p ref={ref} className={cn('line-clamp-2 text-muted-foreground', className)}>
          {text}
        </p>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">{text}</TooltipContent>
    </Tooltip>
  );
}
