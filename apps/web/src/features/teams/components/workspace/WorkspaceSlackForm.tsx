'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { WorkspaceSlackSettings } from '@/lib/api/endpoints/workspaces';
import { useUpdateWorkspaceSlackSettings } from '@/services/workspaces.service';
import { useSlackAppForm } from '@/hooks/useSlackAppForm';
import SlackAppFields from '@/components/common/slack/SlackAppFields';
import EnabledSwitch from '@/components/common/inputs/EnabledSwitch';
import SectionPageView from '@/components/common/page/SectionPageView';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function WorkspaceSlackForm({
  workspaceId,
  settings,
}: {
  workspaceId: number;
  settings: WorkspaceSlackSettings;
}) {
  const t = useTranslations('teams.workspace.slack');
  const tCommon = useTranslations('common');
  const update = useUpdateWorkspaceSlackSettings(workspaceId);
  const form = useSlackAppForm(settings);
  const [enabled, setEnabled] = useState(settings.enabled);
  const [own, setOwn] = useState(settings.own);

  // App fields typed and then hidden again are not sent.
  const ownApp = enabled && own;
  const dirty = enabled !== settings.enabled || own !== settings.own || (ownApp && form.dirty);
  const valid = !ownApp || form.complete;
  const instance = settings.instanceSlackTeamName;

  async function save() {
    await update.mutateAsync({ enabled, own, ...(ownApp && form.patch) });
    form.reset();
    toast.success(t('saved'));
  }

  return (
    <SectionPageView
      title={t('title')}
      description={t('description')}
      actions={
        <Button
          size="sm"
          onClick={() => void save()}
          disabled={!dirty || !valid || update.isPending}
        >
          {update.isPending ? tCommon('saving') : tCommon('save')}
        </Button>
      }
    >
      <SettingsSection
        title={t('notifications')}
        description={t('notificationsHint')}
        action={<EnabledSwitch checked={enabled} onChange={setEnabled} />}
      >
        {enabled && (
          <div className="space-y-6">
            <div className="space-y-1.5 sm:max-w-md">
              <Select value={own ? 'own' : 'instance'} onValueChange={(v) => setOwn(v === 'own')}>
                <SelectTrigger aria-label={t('app')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instance">{t('instanceApp')}</SelectItem>
                  <SelectItem value="own">{t('ownApp')}</SelectItem>
                </SelectContent>
              </Select>
              {!own && (
                <p className="text-xs text-muted-foreground">
                  {instance ? t('instanceAppHint', { workspace: instance }) : t('instanceMissing')}
                </p>
              )}
            </div>
            {own && (
              <SettingsCard className="p-4">
                <SlackAppFields app={settings} form={form} />
              </SettingsCard>
            )}
          </div>
        )}
      </SettingsSection>
    </SectionPageView>
  );
}
