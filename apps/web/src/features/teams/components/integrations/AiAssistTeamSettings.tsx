'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { IntegrationMeta } from '@/lib/api/endpoints/integrations';
import { useIntegrationOptionsQuery } from '@/services/integrations.service';
import { integrationLabel } from '@/utils/integrationLabels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAiAssistSettingsQuery, useSetAiAssistSettings } from '@/services/aiAssist.service';

const OFF = 'off';

// The team's pick of credential and model for the quick AI features.
export default function AiAssistTeamSettings({
  teamId,
  catalog,
  canEdit,
}: {
  teamId: number;
  catalog: IntegrationMeta[];
  canEdit: boolean;
}) {
  const t = useTranslations('aiAssist.settings');
  const settings = useAiAssistSettingsQuery(teamId).data;
  const credentials = useIntegrationOptionsQuery(canEdit ? teamId : null, 'llm').data ?? [];
  const [credential, setCredential] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const save = useSetAiAssistSettings(teamId);
  if (!settings) return null;

  const credentialValue = credential ?? settings.credentialId?.toString() ?? OFF;
  const modelValue = model ?? settings.model ?? '';
  const off = credentialValue === OFF;

  return (
    <section className="mt-8 space-y-3 border-t pt-6">
      <div>
        <h3 className="text-sm font-medium">{t('title')}</h3>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>
      {!canEdit ? (
        <p className="text-sm">
          {settings.model ? t('on', { model: settings.model }) : t('off')}{' '}
          <span className="text-muted-foreground">{t('managersOnly')}</span>
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="w-56 space-y-1.5">
            <span className="text-sm font-medium">{t('credential')}</span>
            <Select value={credentialValue} onValueChange={setCredential}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={OFF}>{t('none')}</SelectItem>
                {credentials.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {integrationLabel(catalog, c.integrationKey)}
                    {c.label ? ` · ${c.label}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          {!off && (
            <label className="w-56 space-y-1.5">
              <span className="text-sm font-medium">{t('model')}</span>
              <Input
                value={modelValue}
                placeholder={t('modelPlaceholder')}
                onChange={(e) => setModel(e.target.value)}
              />
            </label>
          )}
          <Button
            size="sm"
            disabled={save.isPending || (!off && !modelValue.trim())}
            onClick={() =>
              save.mutate(
                off
                  ? { credentialId: null }
                  : { credentialId: Number(credentialValue), model: modelValue.trim() },
                { onSuccess: () => toast.success(t('saved')) },
              )
            }
          >
            {t('save')}
          </Button>
        </div>
      )}
    </section>
  );
}
