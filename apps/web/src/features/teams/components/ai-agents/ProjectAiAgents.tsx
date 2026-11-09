import { MessageSquarePlus, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProjectAgents } from '@/hooks/useProjectAgents';
import { useShell } from '@/context/shellContext';
import { useIntegrationCatalogQuery } from '@/services/integrations.service';
import { integrationLabel } from '@/utils/integrationLabels';
import { AgentRunnerStatus } from '@/components/common/agent-chat/AgentRunnerStatus';
import ListPager from '@/components/common/ListPager';
import { usePaging } from '@/hooks/usePaging';
import { EmptyState } from '@/components/common/page/EmptyState';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AGENT_KIND_ICON } from '../../utils/agentKindIcon';
import { useAgentSection } from '../../context/agentSection';
import { AgentMetaChip } from './AgentMetaChip';
import { AgentMetaRow } from './AgentMetaRow';
import { AgentTriggers } from './AgentTriggers';

// The agents working in this project, read-only: an agent belongs to the team, so it
// is created, attached and edited in the team section. Here a project member sees what
// each agent reacts to and what it is configured with, and starts a chat with one.
export default function ProjectAiAgents() {
  const t = useTranslations('settings.agents');
  const tTeam = useTranslations('teams.agents');
  const tChat = useTranslations('aiChat');
  const tCommon = useTranslations('common');
  const { onChatWithAgent } = useShell();
  const { teamId } = useAgentSection();
  const query = useProjectAgents();
  const paging = usePaging();
  const agents = query.data ?? [];
  // The team's agents come in one list — it is read whole by the chat panel and the
  // schedule editor too — so the page is cut here rather than asked for.
  const shown = paging.slice(agents);
  // The integration catalog maps a provider key to a readable label for the meta row.
  const catalog = useIntegrationCatalogQuery(teamId).data ?? [];

  if (query.isPending) return <ListSkeleton rows={3} rowClassName="h-12" />;
  if (agents.length === 0) return <EmptyState title={t('empty')} description={t('emptyHint')} />;

  return (
    <div className="space-y-4">
      <Table className="min-w-[640px] table-fixed">
        <colgroup>
          <col className="w-[34%]" />
          <col className="w-[18%]" />
          <col className="w-[36%]" />
          <col className="w-[12%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs font-medium text-muted-foreground">
              {tTeam('agent')}
            </TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">
              {tTeam('columns.triggers')}
            </TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">
              {tTeam('columns.configuration')}
            </TableHead>
            <TableHead className="text-end text-xs font-medium text-muted-foreground">
              {tCommon('actions')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((agent) => {
            const KindIcon = AGENT_KIND_ICON[agent.kind];
            return (
              <TableRow key={agent.id} className="group/item">
                <TableCell className="px-3 py-3 align-middle whitespace-normal">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                      <KindIcon className="size-4" />
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">{agent.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        @{agent.username}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-3 align-middle whitespace-normal">
                  <AgentTriggers agent={agent} />
                </TableCell>
                <TableCell className="px-3 py-3 align-middle whitespace-normal">
                  {agent.kind === 'internal' ? (
                    <AgentMetaRow
                      agent={agent}
                      providerLabel={(key: string) => integrationLabel(catalog, key)}
                    />
                  ) : (
                    <div className="flex flex-col items-start gap-1">
                      <AgentRunnerStatus agent={agent} />
                      <AgentMetaChip icon={Shield}>
                        {agent.runnerScope === 'owner'
                          ? tTeam('runnerScopeOwner')
                          : tTeam('runnerScopeTeam')}
                      </AgentMetaChip>
                    </div>
                  )}
                </TableCell>
                <TableCell className="px-3 py-2 align-middle">
                  <div className="flex items-center justify-end">
                    {agent.chatEnabled && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            className="size-8"
                            aria-label={tChat('newChat')}
                            onClick={() => onChatWithAgent(agent.id)}
                          >
                            <MessageSquarePlus className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{tChat('newChat')}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <ListPager paging={paging} total={agents.length} />
    </div>
  );
}
