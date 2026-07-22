import {
  Bot,
  History,
  KeyRound,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { AiAgent } from '@/lib/api';
import { formatShortDate } from '@/utils/dates';
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
import { useSettingsCan } from '../../context/settingsPermission';
import { AgentMetaRow, AgentTriggers } from './AgentMetaRow';

// One agent as a table row: the Agent cell holds the name, @username, kind badge,
// and created date; the Configuration cell shows an internal agent's meta line
// (model, capability/tool/skill counts, enabled triggers) or an external agent's
// non-secret key prefix. Row actions (history/chat/regenerate/edit/delete) sit in
// the last cell. The plaintext key is never here, only apiKeyStart identifies the
// key. `providerLabel` maps a provider key to its catalog label.
export function SettingsAiAgentRow({
  agent,
  providerLabel,
  onChat,
  onRuns,
  onRegenerate,
  onEdit,
  onDelete,
}: {
  agent: AiAgent;
  providerLabel: (key: string) => string;
  onChat: () => void;
  onRuns: () => void;
  onRegenerate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const can = useSettingsCan();
  const canHistory = agent.kind === 'internal' && can('read');
  const canChat = canHistory;
  const canRegenerate = agent.kind === 'external' && can('edit');
  const hasMenu = canChat || canRegenerate || can('delete');

  return (
    <TableRow className="group/item">
      <TableCell className="px-3 py-3 align-top whitespace-normal">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
            <Bot className="size-4" />
          </div>
          <div className="flex min-w-0 flex-col gap-1 pt-0.5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate text-sm font-medium">{agent.name}</span>
              <span className="truncate text-xs text-muted-foreground">@{agent.username}</span>
              <Badge
                variant={agent.kind === 'internal' ? 'secondary' : 'outline'}
                className="shrink-0 capitalize"
              >
                {agent.kind}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground/80">
              Created {formatShortDate(agent.createdAt)}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-3 py-3 pt-4 align-top whitespace-normal">
        {agent.kind === 'internal' ? (
          <AgentTriggers agent={agent} />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="px-3 py-3 pt-4 align-top whitespace-normal">
        {agent.kind === 'internal' ? (
          <AgentMetaRow agent={agent} providerLabel={providerLabel} />
        ) : (
          <span className="text-xs text-muted-foreground">
            {agent.apiKeyStart ? `API key ${agent.apiKeyStart}…` : 'API key'}
          </span>
        )}
      </TableCell>
      <TableCell className="px-3 py-2 pt-3 align-top">
        <div className="flex items-center justify-end gap-1">
          {canHistory && (
            <IconButton title="Run history" onClick={onRuns}>
              <History className="size-4" />
            </IconButton>
          )}
          {can('edit') && (
            <IconButton title="Edit agent" onClick={onEdit}>
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
                <TooltipContent>More actions</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                {canChat && (
                  <DropdownMenuItem className="min-h-11 sm:min-h-8" onSelect={onChat}>
                    <MessageSquare />
                    Test chat
                  </DropdownMenuItem>
                )}
                {canRegenerate && (
                  <DropdownMenuItem className="min-h-11 sm:min-h-8" onSelect={onRegenerate}>
                    <KeyRound />
                    Regenerate key
                  </DropdownMenuItem>
                )}
                {can('delete') && (canChat || canRegenerate) && <DropdownMenuSeparator />}
                {can('delete') && (
                  <DropdownMenuItem
                    className="min-h-11 sm:min-h-8"
                    variant="destructive"
                    onSelect={onDelete}
                  >
                    <Trash2 />
                    Delete agent
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
