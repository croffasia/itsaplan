'use client';

import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import GodAuthProviderForm from './components/auth-provider/GodAuthProviderForm';
import GodSectionPage from './components/GodSectionPage';
import {
  useInstanceGoogleSettingsQuery,
  useInstanceOidcSettingsQuery,
  useInstanceAuthentikSettingsQuery,
} from './services/god.service';

export default function GodAuthProviderPage() {
  const google = useInstanceGoogleSettingsQuery();
  const oidc = useInstanceOidcSettingsQuery();
  const authentik = useInstanceAuthentikSettingsQuery();

  if (!google.data || !oidc.data || !authentik.data) {
    return (
      <GodSectionPage slug="auth-provider">
        <ListSkeleton rows={5} rowClassName="h-12" />
      </GodSectionPage>
    );
  }

  // Keyed on the loaded state: a save replaces the cache entries, so the form
  // remounts with fresh initial values instead of a stale "dirty" comparison.
  return (
    <GodAuthProviderForm
      key={`${JSON.stringify(google.data)}|${JSON.stringify(oidc.data)}|${JSON.stringify(authentik.data)}`}
      googleSettings={google.data}
      oidcSettings={oidc.data}
      authentikSettings={authentik.data}
    />
  );
}
