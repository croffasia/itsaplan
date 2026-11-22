'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { InstanceSlackSettings } from '@/lib/api/endpoints/god';
import { useSlackAppForm } from '@/hooks/useSlackAppForm';
import SlackAppFields from '@/components/common/slack/SlackAppFields';
import SettingsCard from '@/components/common/page/SettingsCard';
import EnabledSwitch from '@/components/common/inputs/EnabledSwitch';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Button } from '@/components/ui/button';
import GodSectionPage from '../GodSectionPage';
import { useUpdateInstanceSlackSettings } from '../../services/god.service';

// The instance app. It can be turned on once every part of it is set: without the client
// ID and secret nobody can connect an account, and without the token nothing is sent.
export default function GodSlackForm({ settings }: { settings: InstanceSlackSettings }) {
  const t = useTranslations('god.slack');
  const tCommon = useTranslations('common');
  const update = useUpdateInstanceSlackSettings();
  const form = useSlackAppForm(settings);
  const [enabled, setEnabled] = useState(settings.enabled);

  const dirty = enabled !== settings.enabled || form.dirty;

  async function save() {
    try {
      await update.mutateAsync({ enabled: enabled && form.complete, ...form.patch });
      form.reset();
      toast.success(t('saved'));
    } catch {
      // The failure already surfaced through the global mutation error toast. A token
      // Slack rejects comes back as a 400 with what it said.
    }
  }

  return (
    <GodSectionPage
      slug="slack"
      actions={
        <Button size="sm" onClick={() => void save()} disabled={!dirty || update.isPending}>
          {update.isPending ? tCommon('saving') : tCommon('save')}
        </Button>
      }
    >
      <SettingsSection
        title={t('app')}
        description={t(form.complete ? 'appConfigured' : 'appMissing')}
        action={
          <EnabledSwitch
            checked={enabled && form.complete}
            onChange={setEnabled}
            disabled={update.isPending || !form.complete}
          />
        }
      >
        <SettingsCard className="p-4">
          <SlackAppFields app={settings} form={form} />
        </SettingsCard>
      </SettingsSection>
    </GodSectionPage>
  );
}
