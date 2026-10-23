import { Cable, Terminal, Webhook } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import { AgentRunnerStatus } from '@/components/common/agent-chat/AgentRunnerStatus';
import type { AgentFormValue } from '../../utils/agentForm';
import { AgentFormSection } from './AgentFormSection';
import { AgentOptionCards } from './AgentOptionCards';
import { AgentRunnerWays } from './AgentRunnerWays';
import AgentInvocationPanel from './AgentInvocationPanel';

// How an external agent gets its tasks: a runner takes them, or they are sent to the
// agent's endpoint. Who may give it tasks is an access question and lives in the Access
// section.
export default function AgentConnectionSection({
  agent,
  value,
  onChange,
  ...section
}: {
  // The saved agent, for its presence and its saved URL. Null while creating.
  agent: AiAgent | null;
  value: AgentFormValue;
  onChange: (patch: Partial<AgentFormValue>) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('teams.agents');

  return (
    <AgentFormSection
      {...section}
      icon={Cable}
      title={t('connection')}
      hint={t('connectionHint')}
      headerRight={<AgentRunnerStatus agent={agent} compact />}
    >
      <AgentOptionCards
        options={[
          {
            value: 'runner',
            icon: Terminal,
            label: t('deliveryRunner'),
            hint: t('deliveryRunnerHint'),
          },
          { value: 'url', icon: Webhook, label: t('deliveryUrl'), hint: t('deliveryUrlHint') },
        ]}
        value={value.delivery}
        onChange={(delivery) => onChange({ delivery })}
      />
      {value.delivery === 'runner' ? (
        <AgentRunnerWays />
      ) : (
        <AgentInvocationPanel agent={agent} value={value} onChange={onChange} />
      )}
    </AgentFormSection>
  );
}
