'use client';

import GodSettingsGate from './components/GodSettingsGate';
import GodSlackForm from './components/slack/GodSlackForm';
import { useInstanceSlackSettingsQuery } from './services/god.service';

export default function GodSlackPage() {
  const query = useInstanceSlackSettingsQuery();

  return (
    <GodSettingsGate slug="slack" data={query.data}>
      {(settings) => <GodSlackForm settings={settings} />}
    </GodSettingsGate>
  );
}
