import { t } from 'elysia';

// The permission model lives in @repo/db, next to the team_role table whose
// `permissions` column holds the matrix. This module adds the API-side pieces.
export {
  PERMISSION_RESOURCES,
  PERMISSION_ACTIONS,
  emptyPermissions,
  fullPermissions,
  defaultMemberPermissions,
  normalizePermissions,
  hasPermission,
  resourceActions,
} from '@repo/db';
export type {
  PermissionResource,
  PermissionAction,
  ResourcePermissions,
  Permissions,
} from '@repo/db';

// The matrix as it crosses the API. Kept as an open record rather than a schema
// per resource: normalizePermissions is what guarantees the keys, and pinning
// them here would mean a schema change for every resource added.
export const PermissionMatrixSchema = t.Record(t.String(), t.Record(t.String(), t.Boolean()));
