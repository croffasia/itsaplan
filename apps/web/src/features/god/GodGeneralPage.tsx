'use client';

import GodSettingsGate from './components/GodSettingsGate';
import GodGeneralForm from './components/general/GodGeneralForm';
import {
  useInstanceAgentSettingsQuery,
  useInstanceApiDocsSettingsQuery,
  useInstanceApiKeySettingsQuery,
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
  const apiDocs = useInstanceApiDocsSettingsQuery().data;
  const apiKeys = useInstanceApiKeySettingsQuery().data;

  return (
    <GodSettingsGate
      slug="general"
      data={
        defaults && auth && agents && embed && sharing && apiDocs && apiKeys
          ? { defaults, auth, agents, embed, sharing, apiDocs, apiKeys }
          : undefined
      }
    >
      {(data) => <GodGeneralForm {...data} />}
    </GodSettingsGate>
  );
}
