'use client';

import GodSettingsGate from './components/GodSettingsGate';
import GodGeneralForm from './components/general/GodGeneralForm';
import {
  useInstanceAgentSettingsQuery,
  useInstanceAuthSettingsQuery,
  useInstanceEmbedSitesQuery,
  useInstanceProjectDefaultsQuery,
  useInstanceSharingSettingsQuery,
} from './services/god.service';

export default function GodGeneralPage() {
  const defaults = useInstanceProjectDefaultsQuery().data;
  const auth = useInstanceAuthSettingsQuery().data;
  const agents = useInstanceAgentSettingsQuery().data;
  const embed = useInstanceEmbedSitesQuery().data;
  const sharing = useInstanceSharingSettingsQuery().data;

  return (
    <GodSettingsGate
      slug="general"
      data={
        defaults && auth && agents && embed && sharing
          ? { defaults, auth, agents, embed, sharing }
          : undefined
      }
    >
      {(data) => <GodGeneralForm {...data} />}
    </GodSettingsGate>
  );
}
