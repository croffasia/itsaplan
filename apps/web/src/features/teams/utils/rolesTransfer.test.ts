import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PermissionCatalog, Role } from '@/lib/api/endpoints/roles';
import { matrixFromCatalog } from '@/utils/permissions';
import { planRolesImport } from './rolesTransfer';

const catalog = {
  resources: [{ key: 'work_items', actions: ['read', 'create', 'edit', 'delete'] }],
  actions: ['read', 'create', 'edit', 'delete'],
} as PermissionCatalog;

const ordered = matrixFromCatalog(catalog, { work_items: { read: true } });
const gap = matrixFromCatalog(catalog, { work_items: { edit: true } });

describe('planRolesImport', () => {
  it('leaves out a role out of granting order, whether it is new or an overwrite', () => {
    const existing = [
      { id: 1, name: 'Member', system: true },
      { id: 2, name: 'Editor', system: false },
    ] as Role[];
    const planned = planRolesImport(
      [
        { name: 'New', permissions: ordered },
        { name: 'editor', permissions: ordered },
        { name: 'New gap', permissions: gap },
        { name: 'Editor', permissions: gap },
        { name: 'Member', permissions: gap },
      ],
      existing,
      catalog,
    );
    assert.deepEqual(
      planned.map((role) => role.action),
      ['create', 'update', 'invalid', 'invalid', 'skip'],
    );
  });
});
