import { formatDateTime } from '@/utils/dates';
import { formatRunDuration } from '@/utils/formatRunDuration';

// When a step started, counted from the run's first step.
export default function AgentRunStepTime({ at, start }: { at: string; start: number }) {
  return (
    <time
      dir="ltr"
      className="text-xs whitespace-nowrap text-muted-foreground tabular-nums"
      dateTime={at}
      title={formatDateTime(at)}
    >
      +{formatRunDuration(Date.parse(at) - start)}
    </time>
  );
}
