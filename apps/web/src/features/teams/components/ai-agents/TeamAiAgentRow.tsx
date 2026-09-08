import { History, MessageSquare, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import { AgentRunnerStatus } from '@/components/common/agent-chat/AgentRunnerStatus';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
// agent's runner presence and non-secret key prefix. Row actions
// (history/chat/edit/delete) sit in the last cell; the key itself is managed in the
// agent's sheet. `providerLabel` maps a provider key to its catalog label.
export function TeamAiAgentRow({
  agent,
  providerLabel,
  onChat,
  onRuns,
  onEdit,
  onDelete,
}: {
  agent: AiAgent;
  providerLabel: (key: string) => string;
  onChat: () => void;
  onRuns: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('teams.agents');
  const can = useAgentCan();
  const canHistory = can('read');
  const KindIcon = AGENT_KIND_ICON[agent.kind];
  const hasMenu = canHistory || can('delete');

  return (
    <TableRow className="group/item">
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
      <TableCell className="px-3 py-2 align-middle">
        <div className="flex items-center justify-end gap-1">
          {canHistory && (
            <IconButton title={t('runHistory')} onClick={onRuns}>
              <History className="size-4" />
            </IconButton>
          )}
          {can('edit') && (
            <IconButton title={t('edit')} onClick={onEdit}>
              <Pencil className="size-4" />
            </IconButton>
          )}
          {hasMenu && (
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
                {canHistory && (
                  <DropdownMenuItem className="min-h-11 sm:min-h-8" onSelect={onChat}>
                    <MessageSquare />
                    {t('testChat')}
                  </DropdownMenuItem>
                )}
                {can('delete') && canHistory && <DropdownMenuSeparator />}
                {can('delete') && (
                  <DropdownMenuItem
                    className="min-h-11 sm:min-h-8"
                    variant="destructive"
                    onSelect={onDelete}
                  >
                    <Trash2 />
                    {t('delete')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function IconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}
