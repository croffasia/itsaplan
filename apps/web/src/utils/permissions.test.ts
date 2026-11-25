import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  PermissionAction,
  PermissionCatalog,
  PermissionCatalogResource,
  PermissionResource,
} from '@/lib/api/endpoints/roles';
import { groupResources, linkedActions, matrixFromCatalog, permissionGaps } from './permissions';

const added = 'agent_added' as PermissionResource;
const loose = 'agent_loose' as PermissionResource;

describe('groupResources', () => {
  it('puts a resource after the one it was split out of', () => {
    const catalog: PermissionCatalogResource[] = [
      { key: 'ai_agents', actions: ['read'] },
      { key: added, actions: ['read'], from: 'ai_agents' },
      { key: 'integrations', actions: ['read'] },
    ];
    const groups = groupResources(
      catalog.map((one) => one.key),
      catalog,
    );
    assert.deepEqual(groups, [{ key: 'ai', resources: ['ai_agents', added, 'integrations'] }]);
  });

  it('leaves a resource no group knows in Other', () => {
    assert.deepEqual(groupResources([loose]), [{ key: 'other', resources: [loose] }]);
  });
});

describe('matrixFromCatalog', () => {
  const catalog = {
    resources: [
      { key: 'ai_agents', actions: ['read', 'edit'] },
      { key: added, actions: ['read', 'edit'], from: 'ai_agents' },
    ],
    actions: ['read', 'edit'],
  } as PermissionCatalog;

  it('reads a role saved before a resource as the one it was split out of', () => {
    const matrix = matrixFromCatalog(catalog, { ai_agents: { read: true } });
    assert.equal(matrix[added].read, true);
    assert.equal(matrix[added].edit, false);
  });

  it('keeps what the role saved of the resource', () => {
    const matrix = matrixFromCatalog(catalog, {
      ai_agents: { read: true },
      [added]: { read: false },
    });
    assert.equal(matrix[added].read, false);
  });
});

describe('linkedActions', () => {
  const all: PermissionAction[] = ['read', 'create', 'edit', 'delete'];

  it('grants an action with every one before it', () => {
    assert.deepEqual(linkedActions(all, 'edit', true), ['read', 'create', 'edit']);
  });

  it('denies an action with every one after it', () => {
    assert.deepEqual(linkedActions(all, 'create', false), ['create', 'edit', 'delete']);
  });
});

describe('permissionGaps', () => {
  const catalog = {
    resources: [
      { key: 'work_items', actions: ['read', 'create', 'edit', 'delete'] },
      { key: 'danger_zone', actions: ['read', 'delete'] },
      { key: 'repositories', actions: ['edit'] },
    ],
    actions: ['read', 'create', 'edit', 'delete'],
  } as PermissionCatalog;
  const gaps = (source: unknown) => permissionGaps(catalog, matrixFromCatalog(catalog, source));

  it('names the resources that grant an action without one before it', () => {
    assert.deepEqual(gaps({ work_items: { read: true, edit: true }, danger_zone: {} }), [
      'work_items',
    ]);
    assert.deepEqual(gaps({ danger_zone: { delete: true } }), ['danger_zone']);
  });

  it('skips the actions a resource does not support', () => {
    assert.deepEqual(
      gaps({ danger_zone: { read: true, delete: true }, repositories: { edit: true } }),
      [],
    );
  });
});
