'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { PermissionAction, PermissionResource } from '@/lib/api';

// The permission resource of the active settings section. Provided once per section
// so the shared CRUD controls can gate their create/edit/delete buttons without every
// call site threading the resource down.
const SettingsResourceContext = createContext<PermissionResource | null>(null);

export function SettingsResourceProvider({
  resource,
  children,
}: {
  resource: PermissionResource;
  children: ReactNode;
}) {
  return (
    <SettingsResourceContext.Provider value={resource}>{children}</SettingsResourceContext.Provider>
  );
}

// Whether the current user may perform an action on the active section's resource.
// Allows everything when used with no provider (a CRUD control reused elsewhere
// keeps working); owners always pass. Gates UI only — the API enforces the matrix.
export function useSettingsCan(): (action: PermissionAction) => boolean {
  const resource = useContext(SettingsResourceContext);
  const { can } = usePermissions();
  return (action) => resource == null || can(resource, action);
}
