import { useTranslations } from 'next-intl';
import type { AgentProject } from '@/lib/api/endpoints/agents';
import { cn } from '@/lib/utils';
import { AgentProjectsPopover } from './AgentProjectsPopover';

// How many project keys a row shows before the rest go behind "+N".
const SHOWN = 3;

// The projects an agent works in, by key, so a long list does not stretch its row. The
// projects a filter ticked (`highlight`, by id) come first and stand out: they are why
// the agent is listed.
export function AgentProjectKeys({
  projects,
  highlight,
  onEdit,
}: {
  projects: AgentProject[];
  highlight: string[];
  onEdit?: () => void;
}) {
  const t = useTranslations('teams.agents');
  if (projects.length === 0) {
    return <span className="text-xs text-muted-foreground/80">{t('noProjectsShort')}</span>;
  }
  const hit = (project: AgentProject) => highlight.includes(String(project.id));
  const ordered = [...projects].sort((a, b) => Number(hit(b)) - Number(hit(a)));

  return (
    <div className="flex min-w-0 items-center gap-1" dir="ltr">
      {ordered.slice(0, SHOWN).map((project) => (
        <span
          key={project.id}
          title={project.name}
          className={cn(
            'shrink-0 rounded px-1.5 py-0.5 font-mono text-xs',
            hit(project) ? 'bg-primary/20 text-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          {project.key}
        </span>
      ))}
      {ordered.length > SHOWN && (
        <AgentProjectsPopover projects={ordered} hidden={ordered.length - SHOWN} onEdit={onEdit} />
      )}
    </div>
  );
}
