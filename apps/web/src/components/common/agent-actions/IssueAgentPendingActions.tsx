'use client';

import { useTranslations } from 'next-intl';
import { useIssuePendingActionsQuery } from '@/services/agentActions.service';
import { AgentPendingActionRow } from './AgentPendingActionRow';

// The agent calls on an issue that wait for approval. Renders nothing when there are
// none, so the issue view mounts it unconditionally.
export function IssueAgentPendingActions({ issueId }: { issueId: number }) {
  const t = useTranslations('teams.agentActions');
  const actions = useIssuePendingActionsQuery(issueId).data ?? [];
  if (actions.length === 0) return null;
  return (
    <section className="rounded-lg border border-border/60">
      <h3 className="border-b border-border/60 px-4 py-2 text-xs font-medium">
        {t('issueTitle', { count: actions.length })}
      </h3>
      <div className="divide-y divide-border/50">
        {actions.map((action) => (
          <AgentPendingActionRow key={action.id} action={action} />
        ))}
      </div>
    </section>
  );
}
