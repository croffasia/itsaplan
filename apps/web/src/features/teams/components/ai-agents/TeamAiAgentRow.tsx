import { Check, Minus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import { Switch } from '@/components/ui/switch';
import { TableCell, TableRow } from '@/components/ui/table';
import { useAgentCan } from '../../context/agentSection';
import { AGENT_KIND_ICON } from '../../utils/agentKindIcon';
import { AgentConfigSummary } from './AgentConfigSummary';
import { AgentProjectKeys } from './AgentProjectKeys';
import { AgentTriggers } from './AgentTriggers';
import { TeamAiAgentMenu } from './TeamAiAgentMenu';

const CELL = 'px-3 py-3 align-middle whitespace-normal';

// One agent as a table row. A click on the row opens the agent's sheet; the other actions
// sit in the menu of the last cell. `highlightProjects` are the project ids a filter
// ticked, shown first. `providerLabel` maps a provider key to its catalog label.
export function TeamAiAgentRow({
  agent,
  providerLabel,
  highlightProjects = [],
  onChat,
  onRuns,
  onEdit,
  onDelete,
  joinsNewProjects,
  joinsNewProjectsPending,
  onJoinsNewProjectsChange,
}: {
  agent: AiAgent;
  providerLabel: (key: string) => string;
  highlightProjects?: string[];
  onChat: () => void;
  onRuns: () => void;
  onEdit: () => void;
  onDelete: () => void;
  joinsNewProjects: boolean;
  joinsNewProjectsPending: boolean;
  // Undefined for a member who cannot change the team's defaults.
  onJoinsNewProjectsChange?: (on: boolean) => void;
}) {
  const t = useTranslations('teams.agents');
  const can = useAgentCan();
  const canHistory = can('read');
  const KindIcon = AGENT_KIND_ICON[agent.kind];
  const kindLabel = t(`kindLabel.${agent.kind}`);
  const canEdit = can('edit') && agent.canManage;
  const canDelete = can('delete') && agent.canManage;

  return (
    <TableRow
      className={`group/item ${canEdit ? 'cursor-pointer' : ''}`}
      onClick={canEdit ? onEdit : undefined}
    >
      <TableCell className={CELL}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
            <span title={kindLabel} className="shrink-0 text-muted-foreground">
              <KindIcon className="size-3.5" aria-hidden />
            </span>
            <span className="sr-only">{kindLabel}</span>
            <span className="truncate">{agent.name}</span>
          </span>
          <span className="truncate text-xs text-muted-foreground">@{agent.username}</span>
        </div>
      </TableCell>
      {/* The popover is portaled but its clicks still bubble to the row through React. */}
      <TableCell className={CELL} onClick={(e) => e.stopPropagation()}>
        <AgentProjectKeys
          projects={agent.projects}
          highlight={highlightProjects}
          onEdit={canEdit ? onEdit : undefined}
        />
      </TableCell>
      <TableCell className={CELL}>
        <AgentTriggers agent={agent} />
      </TableCell>
      <TableCell className={CELL}>
        <AgentConfigSummary agent={agent} providerLabel={providerLabel} />
      </TableCell>
      <TableCell className="px-3 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
        {onJoinsNewProjectsChange ? (
          <Switch
            checked={joinsNewProjects}
            disabled={joinsNewProjectsPending}
            onCheckedChange={onJoinsNewProjectsChange}
            aria-label={t('projectDefaultAria', { agent: agent.name })}
          />
        ) : joinsNewProjects ? (
          <Check className="size-4 text-green-500" aria-label={t('projectDefaultOn')} />
        ) : (
          <Minus className="size-4 text-muted-foreground" aria-label={t('projectDefaultOff')} />
        )}
      </TableCell>
      {/* Menu items are portaled but their clicks still bubble to the row through React. */}
      <TableCell className="px-3 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
        <TeamAiAgentMenu
          onEdit={canEdit ? onEdit : undefined}
          onRuns={canHistory ? onRuns : undefined}
          onChat={canHistory && agent.chatEnabled ? onChat : undefined}
          onDelete={canDelete ? onDelete : undefined}
        />
      </TableCell>
    </TableRow>
  );
}
