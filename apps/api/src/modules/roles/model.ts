import { t } from 'elysia';
import { PermissionMatrixSchema } from '#shared/permissions';

export const projectKeyParams = t.Object({ projectKey: t.String() });

export const roleParams = t.Object({ projectKey: t.String(), roleId: t.Numeric() });

// Permission matrix carried on create/update. Kept loose (a jsonb blob) and
// sanitized by normalizePermissions in the service: unknown keys are dropped,
// values coerced to booleans, missing entries defaulted to false.
const permissions = t.Any();

export const createRoleBody = t.Object({
  name: t.String({ minLength: 1 }),
  permissions,
});

export const updateRoleBody = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  permissions: t.Optional(permissions),
});

// A role DTO (RoleRow from the service).
export const RoleResponse = t.Object({
  id: t.Number(),
  name: t.String(),
  isDefault: t.Boolean(),
  permissions: PermissionMatrixSchema,
  createdAt: t.String(),
});

export const PermissionCatalogResponse = t.Object({
  resources: t.Array(t.String()),
  actions: t.Array(t.String()),
});
