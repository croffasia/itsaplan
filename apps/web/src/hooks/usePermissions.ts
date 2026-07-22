import { useCallback, useContext } from 'react';
import { ShellCtx } from '@/context/shellContext';
import type { PermissionAction, PermissionResource, ProjectDetail } from '@/lib/api';

// The current user's effective access in the active project, read from the payload
// the Shell loads (project.viewer). Owners bypass the matrix (can everything); a
// member is checked against their role's resource x action flags.
//
// These checks gate UI only — hiding a control is convenience, not security. The
// API enforces the same matrix on every request, so a hidden action is also a 403
// if called directly. Mirror the backend one-to-one: can('work_items', 'edit')
// matches the route guard permission: ['work_items', 'edit'].
//
// The project is read from the Shell context. Pass `source` where the context is
// not readable yet (the Shell itself, which renders the provider). Without either
// one every check is false: no project loaded means no permissions.
export function usePermissions(source?: ProjectDetail | null) {
  const ctx = useContext(ShellCtx);
  const project = source ?? ctx?.project ?? null;
  const viewer = project?.viewer ?? null;
  const permissions = project?.permissions ?? null;

  const can = useCallback(
    (resource: PermissionResource, action: PermissionAction) =>
      viewer != null && (viewer.role === 'owner' || permissions?.[resource]?.[action] === true),
    [viewer, permissions],
  );

  return { can, role: viewer?.role ?? null, isOwner: viewer?.role === 'owner' };
}
