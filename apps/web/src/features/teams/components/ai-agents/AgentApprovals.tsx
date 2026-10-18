'use client';

import { useTranslations } from 'next-intl';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import { usePendingActionsQuery } from '@/services/agentActions.service';
import { usePaging } from '@/hooks/usePaging';
import ListPager from '@/components/common/ListPager';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { AgentPendingActionRow } from '@/components/common/agent-actions/AgentPendingActionRow';
import { useAgentSection } from '../../context/agentSection';
import { AgentRequireApprovalSwitch } from './AgentRequireApprovalSwitch';

// The tool calls the agent held for approval, newest first, with the switch that
// turns the checkpoint on for an internal agent.
export function AgentApprovals({ agent }: { agent: AiAgent }) {
  const t = useTranslations('teams.agentActions');
  const paging = usePaging();
  const query = usePendingActionsQuery(useAgentSection().teamId, agent.id, paging.params);
  const page = query.data;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {agent.kind === 'internal' && <AgentRequireApprovalSwitch agent={agent} />}
      {query.isLoading ? (
        <ListSkeleton rows={3} className="p-4" rowClassName="h-16" />
      ) : !page || page.total === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{t('noPending')}</p>
      ) : (
        <>
          <div className="min-h-0 flex-1 divide-y divide-border/50 overflow-y-auto">
            {page.items.map((action) => (
              <AgentPendingActionRow key={action.id} action={action} />
            ))}
          </div>
          <div className="border-t p-3">
            <ListPager paging={paging} total={page.total} />
          </div>
        </>
      )}
    </div>
  );
}
