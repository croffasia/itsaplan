import type { IntegrationMeta } from '@/lib/api';

// The display name of an integration, falling back to its key when the catalog does
// not know it (an integration the API dropped but a stored credential still names).
export function integrationLabel(catalog: IntegrationMeta[], key: string): string {
  return catalog.find((i) => i.key === key)?.label ?? key;
}
