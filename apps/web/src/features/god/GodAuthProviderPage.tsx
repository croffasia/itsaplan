'use client';

import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import GodAuthProviderForm from './components/auth-provider/GodAuthProviderForm';
import GodSectionPage from './components/GodSectionPage';
import {
  useInstanceAuthSettingsQuery,
  useInstanceGoogleSettingsQuery,
  useInstanceOidcSettingsQuery,
  useInstanceSamlSettingsQuery,
} from './services/god.service';

// The sign-in providers: Google, the instance's own OIDC server and its SAML identity
// provider, plus the password switch the SAML section offers. Each is a settings row of
// its own, so this page loads all of them before the form can compare against them.
// GodSettingsGate takes a single query, which is why the gate is spelled out.
export default function GodAuthProviderPage() {
  const google = useInstanceGoogleSettingsQuery();
  const oidc = useInstanceOidcSettingsQuery();
  const saml = useInstanceSamlSettingsQuery();
  const auth = useInstanceAuthSettingsQuery();

  if (!google.data || !oidc.data || !saml.data || !auth.data) {
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
      key={JSON.stringify([google.data, oidc.data, saml.data, auth.data.emailPassword])}
      googleSettings={google.data}
      oidcSettings={oidc.data}
      samlSettings={saml.data}
      authSettings={auth.data}
    />
  );
}
