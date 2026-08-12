'use client';

import { useTranslations } from 'next-intl';
import type { PermissionAction, PermissionResource } from '@/lib/api';

// The labels of the permission matrix: one resource, one action, one display group.
// A key the messages do not carry (a resource added on the API) falls back to its
// prettified slug, so a new permission still reads as words.
export function usePermissionLabels() {
  const t = useTranslations('permissions');
  const prettify = (slug: string) => slug.replace(/_/g, ' ');
  // The catalog is served by the API, so a resource or group key can be one the
  // messages do not carry yet; `t.has` decides, and the cast is what lets the key be
  // built at runtime.
  const label = (key: string, fallback: string) => {
    const messageKey = key as Parameters<typeof t.has>[0];
    return t.has(messageKey) ? t(messageKey) : fallback;
  };

  return {
    resourceLabel: (resource: PermissionResource) =>
      label(`resources.${resource}`, prettify(resource)),
    actionLabel: (action: PermissionAction) => label(`actions.${action}`, prettify(action)),
    groupLabel: (key: string) => label(`groups.${key}`, prettify(key)),
  };
}
