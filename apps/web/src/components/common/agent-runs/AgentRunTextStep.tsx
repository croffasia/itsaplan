import { Flag, MessageSquareText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Markdown from '@/components/common/Markdown';
import type { TracePart } from './externalTraceParts';
import { STEP_ROW } from './agentRunStepRow';
import AgentRunStepTime from './AgentRunStepTime';

function textIcon(part: TracePart, answer: boolean) {
  if (part.error) return X;
  return answer ? Flag : MessageSquareText;
}

function textTone(part: TracePart, answer: boolean) {
  if (part.error) return 'text-destructive-text';
  return answer ? 'text-green-500' : 'text-muted-foreground';
}

// What the agent wrote, or the error the run stopped with. `answer` marks the run's closing
// text.
export default function AgentRunTextStep({
  part,
  start,
  answer,
}: {
  part: Extract<TracePart, { type: 'text' }>;
  start: number;
  answer: boolean;
}) {
  const Icon = textIcon(part, answer);
  return (
    <div data-step-error={part.error ? '' : undefined} className={cn(STEP_ROW, 'items-start')}>
      <span className="pt-0.5">
        <AgentRunStepTime at={part.receivedAt} start={start} />
      </span>
      <Icon aria-hidden className={cn('mt-0.5 size-4', textTone(part, answer))} />
      <div
        className={cn(
          'col-span-2 min-w-0 text-sm sm:col-span-3',
          part.error && 'whitespace-pre-wrap text-destructive-text',
        )}
      >
        {part.error ? <p dir="auto">{part.text}</p> : <Markdown>{part.text}</Markdown>}
      </div>
    </div>
  );
}
