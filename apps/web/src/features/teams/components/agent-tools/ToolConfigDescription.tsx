import { useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// A tool's description cut to two lines. The tooltip with the whole text opens only
// when the cut hides part of it.
export function ToolConfigDescription({ text }: { text: string }) {
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
        <p ref={ref} className="line-clamp-2 pe-10 text-xs text-muted-foreground">
          {text}
        </p>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">{text}</TooltipContent>
    </Tooltip>
  );
}
