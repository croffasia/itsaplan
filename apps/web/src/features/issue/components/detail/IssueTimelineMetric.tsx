import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDuration } from '@/utils/dates';

// One lifecycle figure beside the compact bar: its name, the duration, and what it
// measures behind a tooltip on the dotted underline.

export default function IssueTimelineMetric({
  label,
  ms,
  description,
}: {
  label: string;
  ms: number;
  description: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex cursor-default items-center gap-1.5 underline decoration-dotted underline-offset-4">
          {label}
          <span className="font-medium text-foreground tabular-nums">{formatDuration(ms)}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{description}</TooltipContent>
    </Tooltip>
  );
}
