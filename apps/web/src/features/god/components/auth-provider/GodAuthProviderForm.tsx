'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { InstanceGoogleSettings, InstanceOidcSettings } from '@/lib/api';
import { Button } from '@/components/ui/button';
import GodSectionPage from '../GodSectionPage';
import GodGoogleSettings from './GodGoogleSettings';
import GodOidcSettings from './GodOidcSettings';
import { useGodGoogleForm } from '../../hooks/useGodGoogleForm';
import { useGodOidcForm } from '../../hooks/useGodOidcForm';

// One section per provider, committed through the page's single Save. A third
// provider is another section with its own form hook.
export default function GodAuthProviderForm({
  googleSettings,
  oidcSettings,
}: {
  googleSettings: InstanceGoogleSettings;
  oidcSettings: InstanceOidcSettings;
}) {
  const t = useTranslations('god.authProvider');
  const tCommon = useTranslations('common');
  const google = useGodGoogleForm(googleSettings);
  const oidc = useGodOidcForm(oidcSettings);

  const dirty = google.dirty || oidc.dirty;
  const saving = google.saving || oidc.saving;

  // Only the sections that changed are written, so saving one provider does not
  // resubmit the other's credentials.
  async function save() {
    try {
      if (google.dirty) await google.save();
      if (oidc.dirty) await oidc.save();
      toast.success(t('saved'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <GodSectionPage
      slug="auth-provider"
      actions={
        <Button size="sm" onClick={() => void save()} disabled={!dirty || saving}>
          {saving ? tCommon('saving') : tCommon('save')}
        </Button>
      }
    >
      <div className="space-y-10">
        <GodOidcSettings form={oidc} />
        <GodGoogleSettings form={google} />
      </div>
    </GodSectionPage>
  );
}
