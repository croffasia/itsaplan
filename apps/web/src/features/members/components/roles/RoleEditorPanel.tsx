'use client';

import { Fragment, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type {
  PermissionAction,
  PermissionCatalog,
  PermissionResource,
  Permissions,
  Role,
} from '@/lib/api';
import { useExitOnEscape } from '@/hooks/useExitOnEscape';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateRole, useUpdateRole } from '@/services/roles.service';
import { MatrixCheckbox } from './MatrixCheckbox';
import { actionLabel, groupResources, orderActions, resourceLabel } from '@/utils/permissions';

// A full permission matrix over the catalog, seeded from an existing role (edit)
// or all-false (create). Building from the catalog keeps the grid in sync with the
// API even if the role omitted a cell the catalog defines.
function seedMatrix(catalog: PermissionCatalog, role: Role | null): Permissions {
  const matrix = {} as Permissions;
  for (const resource of catalog.resources) {
    matrix[resource] = {} as Permissions[PermissionResource];
    for (const action of catalog.actions) {
      matrix[resource][action] = role?.permissions[resource]?.[action] === true;
    }
  }
  return matrix;
}

// The check state of a set of cells: all on, all off, or mixed.
function triState(values: boolean[]): boolean | 'indeterminate' {
  if (values.length > 0 && values.every(Boolean)) return true;
  if (values.some(Boolean)) return 'indeterminate';
  return false;
}

// Create or edit a custom role in a right-hand side panel (the same surface the
// issue preview uses). Escape or a backdrop click closes it. The permission matrix
// groups resources and offers quick toggles per column (all resources) and per
// group. On failure the reason is toasted globally and the panel stays open.
export default function RoleEditorPanel({
  projectKey,
  role,
  catalog,
  onClose,
}: {
  projectKey: string;
  role: Role | null;
  catalog: PermissionCatalog;
  onClose: () => void;
}) {
  const [name, setName] = useState(role?.name ?? '');
  const [matrix, setMatrix] = useState<Permissions>(() => seedMatrix(catalog, role));
  const createRole = useCreateRole(projectKey);
  const updateRole = useUpdateRole(projectKey);
  const busy = createRole.isPending || updateRole.isPending;

  useExitOnEscape(onClose);

  const groups = useMemo(() => groupResources(catalog.resources), [catalog.resources]);
  const actions = useMemo(() => orderActions(catalog.actions), [catalog.actions]);

  // Set `value` on every (resource, action) pair in the given sets.
  function apply(resources: PermissionResource[], actions: PermissionAction[], value: boolean) {
    setMatrix((m) => {
      const next = { ...m };
      for (const resource of resources) {
        next[resource] = { ...next[resource] };
        for (const action of actions) next[resource][action] = value;
      }
      return next;
    });
  }

  const cellsFor = (resources: PermissionResource[], actions: PermissionAction[]) =>
    resources.flatMap((r) => actions.map((a) => matrix[r][a]));

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      if (role)
        await updateRole.mutateAsync({
          roleId: role.id,
          patch: { name: trimmed, permissions: matrix },
        });
      else await createRole.mutateAsync({ name: trimmed, permissions: matrix });
      onClose();
    } catch {
      // The global handler toasts the reason (e.g. a duplicate name); stay open.
    }
  }

  return (
    <div
      data-role-editor
      className="fixed inset-0 z-40 flex bg-black/20"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="ml-auto flex h-full w-full flex-col border-l bg-card sm:w-[680px] sm:max-w-[92vw]">
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-medium">{role ? 'Edit role' : 'New role'}</h2>
            <p className="text-xs text-muted-foreground">
              <span className="rounded bg-secondary px-1.5 py-0.5 font-medium text-secondary-foreground">
                {projectKey}
              </span>{' '}
              role permissions
            </p>
          </div>
          <Button variant="ghost" size="icon" className="size-7" onClick={onClose} title="Close">
            <X />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Contributor"
              className="h-9"
            />
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-2 text-left text-xs font-medium">Resource</th>
                {actions.map((action) => {
                  const state = triState(cellsFor(catalog.resources, [action]));
                  return (
                    <th key={action} className="px-1 py-2">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {actionLabel(action)}
                        </span>
                        <MatrixCheckbox
                          checked={state}
                          onCheckedChange={() => apply(catalog.resources, [action], state !== true)}
                          title={`Toggle ${actionLabel(action)} for all resources`}
                          aria-label={`Toggle ${actionLabel(action)} for all resources`}
                        />
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const groupState = triState(cellsFor(group.resources, actions));
                return (
                  <Fragment key={group.title}>
                    <tr className="border-b bg-muted/40">
                      <td className="py-1.5 pr-2">
                        <div className="flex items-center gap-2">
                          <MatrixCheckbox
                            checked={groupState}
                            onCheckedChange={() =>
                              apply(group.resources, actions, groupState !== true)
                            }
                            title={`Toggle all ${group.title} permissions`}
                            aria-label={`Toggle all ${group.title} permissions`}
                          />
                          <span className="text-xs font-medium">{group.title}</span>
                        </div>
                      </td>
                      {actions.map((action) => {
                        const state = triState(cellsFor(group.resources, [action]));
                        return (
                          <td key={action} className="px-1 py-1.5 text-center">
                            <MatrixCheckbox
                              checked={state}
                              onCheckedChange={() =>
                                apply(group.resources, [action], state !== true)
                              }
                              title={`Toggle ${actionLabel(action)} for ${group.title}`}
                              aria-label={`Toggle ${actionLabel(action)} for ${group.title}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                    {group.resources.map((resource) => (
                      <tr key={resource} className="border-b last:border-b-0">
                        <td className="py-2 pr-2 pl-6">{resourceLabel(resource)}</td>
                        {actions.map((action) => (
                          <td key={action} className="px-1 py-2 text-center">
                            <MatrixCheckbox
                              checked={matrix[resource][action]}
                              onCheckedChange={() =>
                                apply([resource], [action], !matrix[resource][action])
                              }
                              aria-label={`${resourceLabel(resource)}: ${actionLabel(action)}`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-6 py-3">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !name.trim()}>
            {role ? 'Save role' : 'Create role'}
          </Button>
        </div>
      </div>
    </div>
  );
}
