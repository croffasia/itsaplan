'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { InstanceGoogleSettings } from '@/lib/api';
import { Button } from '@/components/ui/button';
import GodGoogleSettings from './components/auth-provider/GodGoogleSettings';
import GodSectionPage from './components/GodSectionPage';
import GodSettingsGate from './components/GodSettingsGate';
import { useGodGoogleForm } from './hooks/useGodGoogleForm';
import { useInstanceGoogleSettingsQuery } from './services/god.service';

export default function GodAuthProviderPage() {
  const query = useInstanceGoogleSettingsQuery();

  return (
    <GodSettingsGate slug="auth-provider" data={query.data}>
      {(settings) => <AuthProviderForm settings={settings} />}
    </GodSettingsGate>
  );
}

// Google is the only provider so far. A second one becomes another section on this
// page with its own form hook.
function AuthProviderForm({ settings }: { settings: InstanceGoogleSettings }) {
  const t = useTranslations('god.authProvider');
  const tCommon = useTranslations('common');
  const form = useGodGoogleForm(settings);

  async function save() {
    try {
      await form.save();
      toast.success(t('saved'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <GodSectionPage
      slug="auth-provider"
      actions={
        <Button size="sm" onClick={() => void save()} disabled={!form.dirty || form.saving}>
          {form.saving ? tCommon('saving') : tCommon('save')}
        </Button>
      }
    >
      <GodGoogleSettings form={form} />
    </GodSectionPage>
  );
}
