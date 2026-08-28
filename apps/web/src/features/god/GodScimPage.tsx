'use client';

import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import GodScimSettings from './components/scim/GodScimSettings';
import GodSectionPage from './components/GodSectionPage';
import { useInstanceScimSettingsQuery } from './services/god.service';

// SCIM provisioning: the token an identity provider authenticates with, and what the
// groups it pushes grant. Nothing here is a form the owner fills in and saves — the
// switch and the token act on their own — so there is no page-level Save.
export default function GodScimPage() {
  const settings = useInstanceScimSettingsQuery();

  return (
    <GodSectionPage slug="scim">
      {settings.data ? (
        <GodScimSettings settings={settings.data} />
      ) : (
        <ListSkeleton rows={5} rowClassName="h-12" />
      )}
    </GodSectionPage>
  );
}
