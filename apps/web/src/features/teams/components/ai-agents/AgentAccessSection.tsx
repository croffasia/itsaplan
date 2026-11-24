import { Shield } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import { useSession } from '@/lib/auth-client';
import type { AgentFormValue } from '../../utils/agentForm';
import { AgentFormSection } from './AgentFormSection';
import { useTranslations } from 'next-intl';

// Who may give an external agent work: its owner alone, or any member of the team. What
// the agent may do once it has the work is the role its membership carries in each
// project it works in, set from that project's member list, so it is not part of this
// form.
export default function AgentAccessSection({
  open,
  onOpenChange,
  value,
  onChange,
  agent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: AgentFormValue;
  onChange: (patch: Partial<AgentFormValue>) => void;
  // Null while the agent is being created, when its owner is the caller.
  agent: AiAgent | null;
}) {
  const t = useTranslations('teams.agents');
  const currentUserId = useSession().data?.user.id ?? null;

  // An owner-scoped agent whose owner's account is deleted takes anyone's work.
  function ownerHint() {
    if (!agent) return t('runnerScopeOwnerHint');
    if (!agent.ownerName) return t('runnerScopeTeamHint');
    if (agent.ownerUserId === currentUserId) return t('runnerScopeOwnerHint');
    return t('runnerScopeOwnerNamedHint', { name: agent.ownerName });
  }

  return (
    <AgentFormSection
      open={open}
      onOpenChange={onOpenChange}
      icon={Shield}
      title={t('access')}
      hint={t('accessHint')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="block text-sm font-medium">{t('runnerScope')}</span>
          <span className="block text-xs text-muted-foreground">
            {value.runnerScope === 'owner' ? ownerHint() : t('runnerScopeTeamHint')}
          </span>
        </div>
        <Select
          value={value.runnerScope}
          onValueChange={(v) => onChange({ runnerScope: v as AgentFormValue['runnerScope'] })}
        >
          <SelectTrigger className="min-w-[150px]" aria-label={t('runnerScope')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="owner">{t('runnerScopeOwner')}</SelectItem>
            <SelectItem value="team">{t('runnerScopeTeam')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </AgentFormSection>
  );
}
