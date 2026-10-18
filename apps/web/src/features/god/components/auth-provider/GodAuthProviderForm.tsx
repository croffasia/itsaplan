'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type {
  InstanceAuthSettings,
  InstanceGoogleSettings,
  InstanceOidcSettings,
  InstanceSamlSettings,
} from '@/lib/api/endpoints/god';
import { Button } from '@/components/ui/button';
import GodSectionPage from '../GodSectionPage';
import GodGoogleSettings from './GodGoogleSettings';
import GodOidcSettings from './GodOidcSettings';
import GodSamlSettings from './GodSamlSettings';
import { useGodGoogleForm } from '../../hooks/useGodGoogleForm';
import { useGodOidcForm } from '../../hooks/useGodOidcForm';
import { useGodSamlForm } from '../../hooks/useGodSamlForm';

// One section per provider, committed through the page's single Save. Another
// provider is another section with its own form hook.
export default function GodAuthProviderForm({
  googleSettings,
  oidcSettings,
  samlSettings,
  authSettings,
}: {
  googleSettings: InstanceGoogleSettings;
  oidcSettings: InstanceOidcSettings;
  samlSettings: InstanceSamlSettings;
  authSettings: InstanceAuthSettings;
}) {
  const t = useTranslations('god.authProvider');
  const tCommon = useTranslations('common');
  const google = useGodGoogleForm(googleSettings);
  const oidc = useGodOidcForm(oidcSettings);
  const saml = useGodSamlForm(samlSettings, authSettings);

  const dirty = google.dirty || oidc.dirty || saml.dirty;
  const saving = google.saving || oidc.saving || saml.saving;

  // Only the sections that changed are written, so saving one provider does not
  // resubmit the other's credentials.
  async function save() {
    try {
      if (google.dirty) await google.save();
      if (oidc.dirty) await oidc.save();
      if (saml.dirty) await saml.save();
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
        <GodSamlSettings
          form={saml}
          hasOtherSsoProvider={googleSettings.enabled || oidcSettings.enabled}
        />
        <GodGoogleSettings form={google} />
      </div>
    </GodSectionPage>
  );
}
