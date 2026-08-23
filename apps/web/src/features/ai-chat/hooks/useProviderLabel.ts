'use client';

import { useIntegrationCatalogQuery } from '@/services/integrations.service';

// Maps a model provider key to the label the integration catalog gives it, falling back
// to the key itself while the catalog loads or for a provider it does not carry.
export function useProviderLabel(projectKey: string | null) {
  const catalog = useIntegrationCatalogQuery(projectKey).data ?? [];
  return (key: string) => catalog.find((entry) => entry.key === key)?.label ?? key;
}
