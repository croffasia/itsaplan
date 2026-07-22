import { useState } from 'react';
import { type Issue } from '@/lib/api';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// The "+N more" control for a day cell: a popover listing every issue on that day
// when there are more than the cell shows inline.
export function CalendarDayOverflow({
  issues,
  hidden,
  dot,
  onOpen,
}: {
  issues: Issue[];
  hidden: number;
  dot: (issue: Issue) => string;
  onOpen: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="px-1.5 text-left text-[10px] text-muted-foreground hover:text-foreground"
        >
          +{hidden} more
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-1">
        <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
          {issues.length} issues
        </div>
        <div className="flex max-h-72 flex-col overflow-y-auto">
          {issues.map((issue) => (
            <button
              key={issue.id}
              type="button"
              onClick={() => {
                setOpen(false);
                onOpen(issue.id);
              }}
              className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs hover:bg-accent"
              title={`${issue.identifier} ${issue.title}`}
            >
              <span
                className="inline-block size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: dot(issue) }}
              />
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {issue.identifier}
              </span>
              <span className="truncate text-foreground">{issue.title}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
