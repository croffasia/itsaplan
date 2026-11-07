import { afterEach, describe, it, expect } from 'bun:test';
import {
  PERMISSION_RESOURCES,
  emptyPermissions,
  fullPermissions,
  defaultMemberPermissions,
  extendedFrom,
  hasPermission,
  normalizePermissions,
  resourceActions,
  setPermissionExtensions,
  type PermissionResource,
} from '../../permissions';
import { mergePermissions, readOnlyPermissions, workspaceRoleGrant } from '../../workspace-roles';

// Unit test: the permission matrix is a set of pure functions with no session,
// no HTTP, and no database, so they are tested directly (no Eden Treaty). This
// is the template for the unit/ folder.
describe('hasPermission', () => {
  it('is false for every cell of an empty matrix', () => {
    const p = emptyPermissions();
    expect(hasPermission(p, 'work_items', 'read')).toBe(false);
    expect(hasPermission(p, 'members_manage', 'delete')).toBe(false);
  });

  it('is true for every cell of a full matrix', () => {
    const p = fullPermissions();
    expect(hasPermission(p, 'work_items', 'delete')).toBe(true);
    expect(hasPermission(p, 'members_manage', 'create')).toBe(true);
  });

  it('grants the default member full work_items, and the member list to read only', () => {
    const p = defaultMemberPermissions();
    expect(hasPermission(p, 'work_items', 'create')).toBe(true);
    expect(hasPermission(p, 'work_items', 'delete')).toBe(true);
    expect(hasPermission(p, 'note_boards', 'create')).toBe(true);
    expect(hasPermission(p, 'note_boards', 'delete')).toBe(true);
    expect(hasPermission(p, 'documents', 'create')).toBe(true);
    expect(hasPermission(p, 'documents', 'delete')).toBe(true);
    expect(hasPermission(p, 'dashboards', 'read')).toBe(true);
    expect(hasPermission(p, 'dashboards', 'edit')).toBe(false);
    expect(hasPermission(p, 'members_manage', 'read')).toBe(true);
    expect(hasPermission(p, 'members_manage', 'edit')).toBe(false);
    expect(hasPermission(p, 'members_manage', 'delete')).toBe(false);
  });
});

describe('normalizePermissions', () => {
  it('returns an all-false matrix for non-object input', () => {
    expect(normalizePermissions(null)).toEqual(emptyPermissions());
    expect(normalizePermissions('nope')).toEqual(emptyPermissions());
  });

  it('keeps known cells and drops unknown resources and actions', () => {
    const p = normalizePermissions({
      work_items: { read: true, destroy: true },
      not_a_resource: { read: true },
    });
    expect(hasPermission(p, 'work_items', 'read')).toBe(true);
    expect(hasPermission(p, 'work_items', 'create')).toBe(false);
    expect((p as Record<string, unknown>).not_a_resource).toBeUndefined();
  });

  it('counts only strict true, coercing every other value to false', () => {
    const p = normalizePermissions({
      work_items: { read: true, create: 'true', edit: 1, delete: false },
    });
    expect(hasPermission(p, 'work_items', 'read')).toBe(true);
    expect(hasPermission(p, 'work_items', 'create')).toBe(false);
    expect(hasPermission(p, 'work_items', 'edit')).toBe(false);
    expect(hasPermission(p, 'work_items', 'delete')).toBe(false);
  });
});

describe('setPermissionExtensions', () => {
  const first = 'agent_first' as PermissionResource;
  const second = 'agent_second' as PermissionResource;
  const extend = () =>
    setPermissionExtensions([
      { resource: first, from: 'ai_agents' },
      { resource: second, from: 'ai_agents', actions: ['read'] },
    ]);

  afterEach(() => setPermissionExtensions());

  it('lists the resources after the one they come from, in the order given', () => {
    extend();
    const at = PERMISSION_RESOURCES.indexOf('ai_agents');
    expect(PERMISSION_RESOURCES.slice(at, at + 3)).toEqual(['ai_agents', first, second]);
    expect(extendedFrom(first)).toBe('ai_agents');
    expect(extendedFrom('ai_agents')).toBeUndefined();
  });

  it('takes the actions of the resource it comes from, unless it names its own', () => {
    setPermissionExtensions([{ resource: first, from: 'agent_usage' }]);
    expect(resourceActions(first)).toEqual(['read']);
    extend();
    expect(resourceActions(first)).toEqual(resourceActions('ai_agents'));
    expect(resourceActions(second)).toEqual(['read']);
    expect(fullPermissions()[second]).toEqual({
      create: false,
      edit: false,
      read: true,
      delete: false,
    });
  });

  it('gives a role saved before it what the role holds of its parent, until it is saved', () => {
    extend();
    const saved = { ai_agents: { read: true, edit: true } };
    expect(normalizePermissions(saved)[first]).toMatchObject({ read: true, edit: true });
    expect(normalizePermissions(saved)[second]).toMatchObject({ read: true, edit: false });
    const own = { ...saved, [first]: { read: false } };
    expect(normalizePermissions(own)[first].read).toBe(false);
  });

  it('gives the default role what it holds of the parent', () => {
    extend();
    expect(defaultMemberPermissions()[first]).toEqual(defaultMemberPermissions().ai_agents);
  });

  it('reaches a workspace admin, whose matrix is built when it is read', () => {
    extend();
    const grant = workspaceRoleGrant('admin');
    if (grant === 'owner' || grant === null) throw new Error('admin grants a matrix');
    expect(grant[first].read).toBe(true);
    expect(mergePermissions(grant, readOnlyPermissions())[first].edit).toBe(false);
  });

  it('puts the core matrix back when called with nothing', () => {
    extend();
    setPermissionExtensions();
    expect(PERMISSION_RESOURCES).not.toContain(first);
    expect(extendedFrom(first)).toBeUndefined();
  });
});
