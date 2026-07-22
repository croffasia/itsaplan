'use client';

import Link from 'next/link';
import { ArrowUpRight, Cpu } from 'lucide-react';
import type { IntegrationCredential, IntegrationMeta, ProviderModel } from '@/lib/api';
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
  credentials: IntegrationCredential[];
  catalog: IntegrationMeta[];
  models: ProviderModel[];
  modelsLoading: boolean;
}) {
  const credentialLabel = (c: IntegrationCredential) => {
    const integration = integrationLabel(catalog, c.integrationKey);
    return c.label ? `${integration} · ${c.label}` : integration;
  };

  return (
    <AgentFormSection
      id="model"
      open={open}
      onOpenChange={onOpenChange}
      icon={Cpu}
      title="Model"
      hint="Provider, model, and system prompt"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Credential</span>
          {credentials.length === 0 ? (
            <div className="space-y-2 rounded-md bg-muted/60 px-3 py-2.5">
              <p className="text-xs font-medium">Add an AI provider key first</p>
              <p className="text-xs text-muted-foreground">
                The agent needs a provider key to pick a model.
              </p>
              <Link
                href={integrationsPath(projectKey)}
                className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                Add a key on Integrations
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
                <SelectValue placeholder="Choose a credential" />
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
          <span className="text-sm font-medium">Model</span>
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
