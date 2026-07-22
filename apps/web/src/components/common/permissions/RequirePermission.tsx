'use client';

import type { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { PermissionAction, PermissionResource } from '@/lib/api';

// Gates a whole page or section: renders children when the current user may perform
// `action` on `resource`, otherwise a short access message. The API enforces the
// same check per request, so this is UX (a clear notice instead of a failed
// request), not a security boundary.
export default function RequirePermission({
  resource,
  action,
  message = 'You do not have access to this section.',
  children,
}: {
  resource: PermissionResource;
  action: PermissionAction;
  message?: string;
  children: ReactNode;
}) {
  const { can } = usePermissions();
  if (!can(resource, action)) {
    return <p className="text-sm text-muted-foreground">{message}</p>;
  }
  return <>{children}</>;
}
