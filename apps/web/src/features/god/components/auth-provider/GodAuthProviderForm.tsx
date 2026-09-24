'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type {
  InstanceAuthentikSettings,
  InstanceGoogleSettings,
  InstanceOidcSettings,
} from '@/lib/api/endpoints/god';
import { Button } from '@/components/ui/button';
import GodSectionPage from '../GodSectionPage';
import GodGoogleSettings from './GodGoogleSettings';
import GodOidcSettings from './GodOidcSettings';
import GodAuthentikSettings from './GodAuthentikSettings';
import { useGodGoogleForm } from '../../hooks/useGodGoogleForm';
import { useGodOidcForm } from '../../hooks/useGodOidcForm';
import { useGodAuthentikForm } from '../../hooks/useGodAuthentikForm';

export default function GodAuthProviderForm({
  googleSettings,
  oidcSettings,
  authentikSettings,
}: {
  googleSettings: InstanceGoogleSettings;
  oidcSettings: InstanceOidcSettings;
  authentikSettings: InstanceAuthentikSettings;
}) {
  const t = useTranslations('god.authProvider');
  const tCommon = useTranslations('common');
  const google = useGodGoogleForm(googleSettings);
  const oidc = useGodOidcForm(oidcSettings);
  const authentik = useGodAuthentikForm(authentikSettings);

  const dirty = google.dirty || oidc.dirty || authentik.dirty;
  const saving = google.saving || oidc.saving || authentik.saving;

  // Only the sections that changed are written, so saving one provider does not
  // resubmit the other's credentials.
  async function save() {
    try {
      if (google.dirty) await google.save();
      if (oidc.dirty) await oidc.save();
      if (authentik.dirty) await authentik.save();
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
        <GodAuthentikSettings form={authentik} />
        <GodGoogleSettings form={google} />
      </div>
    </GodSectionPage>
  );
}
