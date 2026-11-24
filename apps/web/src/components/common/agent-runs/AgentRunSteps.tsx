import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { formatRunDuration } from '@/utils/formatRunDuration';
import type { TracePart } from './externalTraceParts';
import AgentRunStep from './AgentRunStep';

const timeOf = (parts: TracePart[]) => parts.reduce((sum, part) => sum + (part.durationMs ?? 0), 0);

// A run's steps on one time scale that starts at its first step, under a line that says
// where the time went. `controls` sits at the end of that line.
export default function AgentRunSteps({
  parts,
  controls,
}: {
  parts: TracePart[];
  controls?: ReactNode;
}) {
  const t = useTranslations('issue.agentRuns');
  const start = Math.min(...parts.map((part) => Date.parse(part.receivedAt)));
  const end = Math.max(
    ...parts.map((part) => Date.parse(part.receivedAt) + (part.durationMs ?? 0)),
  );
  const tools = parts.filter((part) => part.type === 'tool');
  const models = parts.filter((part) => part.type === 'model');
  const errors = parts.filter((part) => part.error).length;
  const summary = [
    t('toolCalls', { count: tools.length }),
    models.length > 0 && t('modelTime', { duration: formatRunDuration(timeOf(models)) }),
    tools.length > 0 && t('toolTime', { duration: formatRunDuration(timeOf(tools)) }),
    errors > 0 && t('stepErrors', { count: errors }),
  ]
    .filter(Boolean)
    .join(' · ');
  const lastText = parts.findLastIndex((part) => part.type === 'text' && !part.error);
  return (
    <div className="space-y-2">
      <div className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-[13px] text-muted-foreground">{summary}</p>
        {controls && <div className="ms-auto flex items-center gap-3">{controls}</div>}
      </div>
      <ol>
        {parts.map((part, index) => (
          <li key={index}>
            <AgentRunStep
              part={part}
              start={start}
              total={Math.max(end - start, 1)}
              answer={index === lastText}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
