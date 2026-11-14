import type { IntegrationMeta } from '@/lib/api/endpoints/integrations';

// The integration a stored credential or tool names, for its name and icon. When the
// catalog does not know it (an integration the API dropped but a stored credential still
// names), a stand-in carries the key as its name.
export function integrationOf(
  catalog: IntegrationMeta[],
  key: string,
): Pick<IntegrationMeta, 'label' | 'kind' | 'icon'> {
  return catalog.find((i) => i.key === key) ?? { label: key, kind: 'tool' };
}
