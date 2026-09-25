import { Check, History, MessageSquare, Minus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import { AgentRunnerStatus } from '@/components/common/agent-chat/AgentRunnerStatus';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableCell, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AGENT_KIND_ICON } from '../../utils/agentKindIcon';
import { useAgentCan } from '../../context/agentSection';
import { AgentMetaRow } from './AgentMetaRow';
import { AgentTriggers } from './AgentTriggers';
import { useTranslations } from 'next-intl';

// One agent as a table row: the Agent cell holds the name, @username, an icon for the
// kind, and the projects the agent works in; the Configuration cell shows an
// internal agent's meta line (model, capability/tool/skill counts) or an external
// agent's runner presence and non-secret key prefix. A click on the row opens the
// agent's sheet; the other actions sit in the menu of the last cell. `providerLabel` maps a provider key to its catalog label.
export function TeamAiAgentRow({
  agent,
  providerLabel,
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
  const tCommon = useTranslations('common');
  const can = useAgentCan();
  const canHistory = can('read');
  const KindIcon = AGENT_KIND_ICON[agent.kind];
  const canEdit = can('edit');
  const hasMenu = canEdit || canHistory || can('delete');

  return (
    <TableRow
      className={`group/item ${canEdit ? 'cursor-pointer' : ''}`}
      onClick={canEdit ? onEdit : undefined}
    >
      <TableCell className="px-3 py-3 align-middle whitespace-normal">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
            <KindIcon className="size-4" />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate text-sm font-medium">{agent.name}</span>
              <span className="truncate text-xs text-muted-foreground">@{agent.username}</span>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              {agent.projects.length === 0 ? (
                <span className="text-xs text-muted-foreground/80">{t('noProjectsShort')}</span>
              ) : (
                agent.projects.map((project) => (
                  <Badge key={project.id} variant="outline" className="shrink-0 font-mono text-xs">
                    {project.key}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-3 py-3 align-middle whitespace-normal">
        <AgentTriggers agent={agent} />
      </TableCell>
      <TableCell className="px-3 py-3 align-middle whitespace-normal">
        {agent.kind === 'internal' ? (
          <AgentMetaRow agent={agent} providerLabel={providerLabel} />
        ) : (
          <div className="flex flex-col gap-1">
            <AgentRunnerStatus agent={agent} />
            <span className="text-xs text-muted-foreground">
              {agent.apiKeyStart ? t('apiKeyValue', { start: agent.apiKeyStart }) : t('apiKey')}
            </span>
          </div>
        )}
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
        {hasMenu && (
          <div className="flex justify-end">
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>{t('moreActions')}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem className="min-h-11 sm:min-h-8" onSelect={onEdit}>
                    <Pencil />
                    {tCommon('edit')}
                  </DropdownMenuItem>
                )}
                {canHistory && (
                  <DropdownMenuItem className="min-h-11 sm:min-h-8" onSelect={onRuns}>
                    <History />
                    {t('runHistory')}
                  </DropdownMenuItem>
                )}
                {canHistory && (
                  <DropdownMenuItem className="min-h-11 sm:min-h-8" onSelect={onChat}>
                    <MessageSquare />
                    {t('testChat')}
                  </DropdownMenuItem>
                )}
                {can('delete') && (canEdit || canHistory) && <DropdownMenuSeparator />}
                {can('delete') && (
                  <DropdownMenuItem
                    className="min-h-11 sm:min-h-8"
                    variant="destructive"
                    onSelect={onDelete}
                  >
                    <Trash2 />
                    {tCommon('delete')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
