'use client';

import { Check, Minus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import { useSetRequireApproval } from '@/services/agentActions.service';
import { Switch } from '@/components/ui/switch';
import { useAgentCan, useAgentSection } from '../../context/agentSection';

// Whether the agent's changes wait for a project member. A member who cannot edit the
// agent reads the state instead of a switch.
export function AgentRequireApprovalSwitch({ agent }: { agent: AiAgent }) {
  const t = useTranslations('teams.agentActions');
  const can = useAgentCan();
  const save = useSetRequireApproval(useAgentSection().teamId, agent.id);
  const on = save.isPending ? !!save.variables : agent.requireApproval;

  return (
    <div className="flex items-start gap-3 border-b px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t('requireApproval')}</p>
        <p className="text-xs text-muted-foreground">{t('requireApprovalHint')}</p>
      </div>
      {can('edit') ? (
        <Switch
          checked={on}
          onCheckedChange={(value) => save.mutate(value)}
          aria-label={t('requireApproval')}
        />
      ) : (
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          {on ? <Check className="size-3.5" /> : <Minus className="size-3.5" />}
          {on ? t('on') : t('off')}
        </span>
      )}
    </div>
  );
}
