import { describe, it, expect } from 'bun:test';
import {
  emptyPermissions,
  fullPermissions,
  defaultMemberPermissions,
  hasPermission,
  normalizePermissions,
} from '../../permissions';

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

  it('grants the default member full work_items but not member management', () => {
    const p = defaultMemberPermissions();
    expect(hasPermission(p, 'work_items', 'create')).toBe(true);
    expect(hasPermission(p, 'work_items', 'delete')).toBe(true);
    expect(hasPermission(p, 'dashboards', 'read')).toBe(true);
    expect(hasPermission(p, 'dashboards', 'edit')).toBe(false);
    expect(hasPermission(p, 'members_manage', 'read')).toBe(false);
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
