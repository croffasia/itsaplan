import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatDateTime, formatTime } from '@/utils/dates';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import AgentChatToolBlock from '@/components/common/agent-chat/AgentChatToolBlock';
import Markdown from '@/components/common/Markdown';
import type { TracePart } from './externalTraceParts';

// An MCP tool reaches the agent as `mcp__<server>__<tool>`; the server adds nothing here.
function toolLabel(name: string): string {
  if (!name.startsWith('mcp__')) return name;
  const end = name.indexOf('__', 5);
  return end === -1 ? name : name.slice(end + 2);
}

export default function AgentRunStep({ part }: { part: TracePart }) {
  const t = useTranslations('common.agentChat');
  const time = (
    <time
      className="w-20 shrink-0 pt-0.5 font-mono text-xs whitespace-nowrap text-muted-foreground"
      dateTime={part.receivedAt}
      title={formatDateTime(part.receivedAt)}
    >
      {formatTime(part.receivedAt, { seconds: true })}
    </time>
  );
  if (part.type === 'text') {
    return (
      <div className="flex gap-3 py-1.5">
        {time}
        <div className="min-w-0 flex-1 ps-5.5 text-sm">
          <Markdown>{part.text}</Markdown>
        </div>
      </div>
    );
  }
  const label = (
    <>
      <span className="shrink-0 font-medium">{toolLabel(part.toolName)}</span>
      {part.args && (
        <span className="truncate font-mono text-xs text-muted-foreground" dir="ltr">
          {part.args}
        </span>
      )}
    </>
  );
  if (!part.args && !part.result) {
    return (
      <div className="flex gap-3 py-1.5">
        {time}
        <span className="flex min-w-0 items-baseline gap-2 ps-5.5 text-sm">{label}</span>
      </div>
    );
  }
  return (
    <Collapsible className="flex gap-3 py-1.5">
      {time}
      <div className="min-w-0 flex-1">
        <CollapsibleTrigger className="group flex w-full min-w-0 items-baseline gap-2 rounded-sm text-start text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <ChevronRight className="size-3.5 shrink-0 self-center text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-90 rtl:group-data-[state=closed]:rotate-180" />
          {label}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 ps-5.5 pt-2">
          {part.args && <AgentChatToolBlock label={t('toolInput')} text={part.args} />}
          {part.result && <AgentChatToolBlock label={t('toolOutput')} text={part.result} />}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
