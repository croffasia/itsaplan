'use client';

import GodAuthenticationForm from './components/authentication/GodAuthenticationForm';
import GodSettingsGate from './components/GodSettingsGate';
import { useInstanceAuthSettingsQuery } from './services/god.service';

export default function GodAuthenticationPage() {
  const auth = useInstanceAuthSettingsQuery();

  return (
    <GodSettingsGate slug="authentication" data={auth.data}>
      {(settings) => <GodAuthenticationForm authSettings={settings} />}
    </GodSettingsGate>
  );
}
