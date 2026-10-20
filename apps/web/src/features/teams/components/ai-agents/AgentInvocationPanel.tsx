import { useTranslations } from 'next-intl';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import { Input } from '@/components/ui/input';
import { useAgentCan } from '../../context/agentSection';
import type { AgentFormValue } from '../../utils/agentForm';
import AgentInvocationSecret from './AgentInvocationSecret';
import AgentInvocationTest from './AgentInvocationTest';
import { AgentInvocationHelpSheet } from './AgentInvocationHelpSheet';

// The endpoint an external agent's tasks are sent to. The secret and the test act on
// what the server holds, so they appear once a URL is saved and keep addressing that
// one while an edit to it is unsaved.
export default function AgentInvocationPanel({
  agent,
  value,
  onChange,
}: {
  agent: AiAgent | null;
  value: AgentFormValue;
  onChange: (patch: Partial<AgentFormValue>) => void;
}) {
  const t = useTranslations('teams.agents');
  const can = useAgentCan();
  const saved = agent?.invocationUrl ?? null;
  const edited = saved !== null && value.invocationUrl.trim() !== saved;

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="agent-invocation-url" className="text-sm font-medium">
          {t('invocationUrl')}
        </label>
        <Input
          id="agent-invocation-url"
          type="url"
          inputMode="url"
          dir="ltr"
          autoComplete="off"
          placeholder={t('invocationUrlPlaceholder')}
          value={value.invocationUrl}
          onChange={(e) => onChange({ invocationUrl: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          {edited ? t('invocationUnsaved') : t('invocationUrlHint')}
        </p>
      </div>

      {!agent || !saved ? (
        <p className="text-xs text-muted-foreground">{t('invocationSecretOnSave')}</p>
      ) : (
        can('edit') && (
          <>
            <AgentInvocationSecret agent={agent} />
            <AgentInvocationTest agentId={agent.id} />
          </>
        )
      )}

      <AgentInvocationHelpSheet />
    </div>
  );
}
