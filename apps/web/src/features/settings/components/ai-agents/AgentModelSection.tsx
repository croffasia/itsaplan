'use client';

import Link from 'next/link';
import { ArrowUpRight, Cpu } from 'lucide-react';
import type { IntegrationMeta, IntegrationOption, ProviderModel } from '@/lib/api';
import { integrationsPath } from '@/utils/paths';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AgentFormValue } from '../../utils/agentForm';
import { integrationLabel } from '../../utils/integrationLabels';
import { AgentFormSection } from './AgentFormSection';
import { AgentInstructionsField } from './AgentInstructionsField';
import AgentModelField from './AgentModelField';
import { useTranslations } from 'next-intl';

// Which provider key the agent runs on, which model of that provider, and the system
// prompt. Only internal agents have it.
export default function AgentModelSection({
  open,
  onOpenChange,
  value,
  onChange,
  projectKey,
  credentials,
  catalog,
  models,
  modelsLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: AgentFormValue;
  onChange: (patch: Partial<AgentFormValue>) => void;
  projectKey: string;
  credentials: IntegrationOption[];
  catalog: IntegrationMeta[];
  models: ProviderModel[];
  modelsLoading: boolean;
}) {
  const t = useTranslations('settings.agents');
  const credentialLabel = (c: IntegrationOption) => {
    const integration = integrationLabel(catalog, c.integrationKey);
    return c.label ? `${integration} · ${c.label}` : integration;
  };

  return (
    <AgentFormSection
      id="model"
      open={open}
      onOpenChange={onOpenChange}
      icon={Cpu}
      title={t('model')}
      hint={t('modelHint')}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <span className="text-sm font-medium">{t('credential')}</span>
          {credentials.length === 0 ? (
            <div className="space-y-2 rounded-md bg-muted/60 px-3 py-2.5">
              <p className="text-xs font-medium">{t('noCredential')}</p>
              <p className="text-xs text-muted-foreground">{t('noCredentialHint')}</p>
              <Link
                href={integrationsPath(projectKey)}
                className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                {t('addKey')}
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          ) : (
            <Select
              value={value.modelCredentialId != null ? String(value.modelCredentialId) : ''}
              onValueChange={(v) => {
                const id = Number(v);
                // Switching provider clears the model: the models are per credential.
                onChange(
                  id === value.modelCredentialId
                    ? { modelCredentialId: id }
                    : { modelCredentialId: id, model: '' },
                );
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('chooseCredential')} />
              </SelectTrigger>
              <SelectContent>
                {credentials.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {credentialLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-1.5">
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

      <AgentInstructionsField
        value={value.instructions}
        onChange={(instructions) => onChange({ instructions })}
      />
    </AgentFormSection>
  );
}
