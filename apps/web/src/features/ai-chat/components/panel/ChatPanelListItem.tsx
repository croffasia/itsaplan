import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import AgentTile from '@/components/common/agent-chat/AgentTile';

// One conversation in the list. The actions sit next to the row rather than inside it, so
// the row stays a single button; they take the place of the time while it is pointed at,
// and on a touch screen while it is the open one.
// `query` is the search the list was filtered by: the row marks it where it appears, in the
// title and in the snippet the search brought back.
export function ChatPanelListItem({
  title,
  agentName,
  snippet,
  when,
  answering = false,
  active,
  query = '',
  onSelect,
  actions,
}: {
  title: string;
  agentName: string;
  snippet?: string;
  when?: string;
  answering?: boolean;
  active: boolean;
  query?: string;
  onSelect: () => void;
  actions?: ReactNode;
}) {
  const tRuns = useTranslations('issue.agentRuns');

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onSelect}
        aria-current={active}
        className={cn(
          'grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg p-2 text-start transition-colors',
          active ? 'bg-accent' : 'hover:bg-accent/60',
        )}
      >
        <AgentTile
          size="lg"
          working={answering}
          className={cn('row-span-2', active && 'bg-background')}
        />
        <span dir="auto" className="truncate text-sm font-medium">
          {mark(title, query)}
        </span>
        <span
          className={cn(
            'text-xs text-muted-foreground tabular-nums',
            actions && 'group-hover:invisible group-has-focus-visible:invisible',
            actions && active && '[@media(hover:none)]:invisible',
          )}
        >
          {when}
        </span>
        {snippet && (
          <span dir="auto" className="col-start-2 truncate text-xs text-muted-foreground">
            {mark(snippet.replace(/\s+/g, ' ').trim(), query)}
          </span>
        )}
        <span className="col-start-2 truncate text-xs text-muted-foreground">
          {answering ? `${agentName} · ${tRuns('running')}` : agentName}
        </span>
      </button>
      {actions && (
        <div
          className={cn(
            'pointer-events-none absolute end-1.5 top-1.5 flex opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-has-focus-visible:opacity-100',
            active && '[@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100',
          )}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

// The text with the first occurrence of the search marked. The search ran in the
// database, so the same query string is matched here again rather than returned.
function mark(text: string, query: string): ReactNode {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[2px] bg-primary/20 text-foreground">
        {text.slice(at, at + query.length)}
      </mark>
      {text.slice(at + query.length)}
    </>
  );
}
