import { LoaderCircle, MessageSquare, Wrench, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { formatRunDuration } from '@/utils/formatRunDuration';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import AgentChatToolBlock from '@/components/common/agent-chat/AgentChatToolBlock';
import type { TracePart } from './externalTraceParts';
import { STEP_ROW, UNDER_NAME } from './agentRunStepRow';
import AgentRunStepTime from './AgentRunStepTime';
import AgentRunTextStep from './AgentRunTextStep';

// An MCP tool reaches the agent as `mcp__<server>__<tool>`; the server adds nothing here.
function toolLabel(name: string): string {
  if (!name.startsWith('mcp__')) return name;
  const end = name.indexOf('__', 5);
  return end === -1 ? name : name.slice(end + 2);
}

function stepIcon(part: TracePart) {
  if (part.error) return X;
  if (part.running) return LoaderCircle;
  return part.type === 'model' ? MessageSquare : Wrench;
}

function barTone(part: TracePart) {
  if (part.error) return 'bg-destructive';
  return part.type === 'model' ? 'bg-muted-foreground/40' : 'bg-foreground/70';
}

// One step of a run: when it started after the run's first step and, where the trace
// records it, how long it took. `answer` marks the run's closing text.
export default function AgentRunStep({
  part,
  start,
  total,
  answer = false,
}: {
  part: TracePart;
  start: number;
  total: number;
  answer?: boolean;
}) {
  const t = useTranslations('common.agentChat');
  const tRuns = useTranslations('issue.agentRuns');
  if (part.type === 'text') return <AgentRunTextStep part={part} start={start} answer={answer} />;
  const offset = Date.parse(part.receivedAt) - start;
  const Icon = stepIcon(part);
  const cells = (
    <>
      <AgentRunStepTime at={part.receivedAt} start={start} />
      <Icon
        aria-hidden
        className={cn(
          'size-4',
          part.error ? 'text-destructive-text' : 'text-muted-foreground',
          part.running && 'animate-spin motion-reduce:animate-none',
        )}
      />
      <span className="flex min-w-0 items-baseline gap-2 text-sm">
        {part.type === 'model' ? (
          <span className="truncate text-muted-foreground">{tRuns('modelCall')}</span>
        ) : (
          <span className={cn('truncate font-medium', part.error && 'text-destructive-text')}>
            {toolLabel(part.toolName)}
          </span>
        )}
      </span>
      <span aria-hidden dir="ltr" className="relative hidden h-1.5 rounded-full bg-muted sm:block">
        {part.durationMs != null && (
          <span
            className={cn('absolute inset-y-0 min-w-0.5 rounded-full', barTone(part))}
            style={{
              insetInlineStart: `${Math.min((offset / total) * 100, 100)}%`,
              width: `${Math.min((part.durationMs / total) * 100, 100)}%`,
            }}
          />
        )}
      </span>
      <span className="text-end text-xs text-muted-foreground tabular-nums">
        {part.durationMs != null && formatRunDuration(part.durationMs)}
      </span>
    </>
  );
  const error = part.error && (
    <p
      className={cn(UNDER_NAME, 'pb-1 text-sm whitespace-pre-wrap text-destructive-text')}
      dir="auto"
    >
      {part.error}
    </p>
  );
  if (part.type === 'model' || (!part.args && !part.result)) {
    return (
      <div data-step-error={part.error ? '' : undefined}>
        <div className={STEP_ROW}>{cells}</div>
        {error}
      </div>
    );
  }
  return (
    <Collapsible data-step-error={part.error ? '' : undefined}>
      <CollapsibleTrigger
        className={cn(
          STEP_ROW,
          'outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50',
        )}
      >
        {cells}
      </CollapsibleTrigger>
      {error}
      <CollapsibleContent className={cn(UNDER_NAME, 'space-y-2 pt-1 pb-3')}>
        {part.args && <AgentChatToolBlock label={t('toolInput')} text={part.args} />}
        {part.result && <AgentChatToolBlock label={t('toolOutput')} text={part.result} />}
      </CollapsibleContent>
    </Collapsible>
  );
}
