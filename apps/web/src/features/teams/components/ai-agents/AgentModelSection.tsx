'use client';

import { Cpu, KeyRound } from 'lucide-react';
import type {
  IntegrationMeta,
  IntegrationOption,
  ProviderModel,
} from '@/lib/api/endpoints/integrations';
import { manageTeamsPath } from '@/utils/paths';
import type { AgentFormValue } from '../../utils/agentForm';
import { integrationLabel } from '@/utils/integrationLabels';
import { AgentFormSection } from './AgentFormSection';
import { AgentEmptyNotice } from './AgentEmptyNotice';
import AgentCredentialField from './AgentCredentialField';
import AgentModelField from './AgentModelField';
import { useTranslations } from 'next-intl';

// Which provider key the agent runs on and which model of that provider. Only
// internal agents have it. With no provider key on the team both pickers are
// replaced by a notice that points at the team panel, where the credentials live.
export default function AgentModelSection({
  open,
  onOpenChange,
  value,
  onChange,
  credentials,
  catalog,
  models,
  modelsLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: AgentFormValue;
  onChange: (patch: Partial<AgentFormValue>) => void;
  credentials: IntegrationOption[];
  catalog: IntegrationMeta[];
  models: ProviderModel[];
  modelsLoading: boolean;
}) {
  const t = useTranslations('teams.agents');
  const credentialLabel = (c: IntegrationOption) => {
    const integration = integrationLabel(catalog, c.integrationKey);
    return c.label ? `${integration} · ${c.label}` : integration;
  };

  return (
    <AgentFormSection
      open={open}
      onOpenChange={onOpenChange}
      icon={Cpu}
      title={t('model')}
      hint={t('modelHint')}
    >
      {credentials.length === 0 ? (
        <AgentEmptyNotice
          icon={KeyRound}
          title={t('noCredential')}
          hint={t('noCredentialHint')}
          href={manageTeamsPath()}
          linkLabel={t('addKey')}
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          <div className="max-w-[250px] min-w-0 flex-1 basis-44 space-y-1.5">
            <span className="text-sm font-medium">{t('credential')}</span>
            <AgentCredentialField
              value={value.modelCredentialId}
              credentials={credentials}
              label={credentialLabel}
              onChange={(id) =>
                // Switching provider clears the model: the models are per credential.
                onChange(
                  id === value.modelCredentialId
                    ? { modelCredentialId: id }
                    : { modelCredentialId: id, model: '' },
                )
              }
            />
          </div>
          <div className="max-w-[250px] min-w-0 flex-1 basis-44 space-y-1.5">
            <span className="text-sm font-medium">{t('model')}</span>
            <AgentModelField
              value={value.model}
              onChange={(model) => onChange({ model })}
              models={models}
              loading={modelsLoading}
              disabled={value.modelCredentialId == null}
            />
          </div>
        </div>
      )}
    </AgentFormSection>
  );
}
