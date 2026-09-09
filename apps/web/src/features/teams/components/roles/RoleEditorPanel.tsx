'use client';

import { Fragment, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  PermissionAction,
  PermissionCatalog,
  PermissionResource,
  Permissions,
  Role,
} from '@/lib/api/endpoints/roles';
import { useExitOnEscape } from '@/hooks/useExitOnEscape';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateRole, useUpdateRole } from '@/services/roles.service';
import { MatrixCheckbox } from './MatrixCheckbox';
import {
  catalogSupport,
  groupResources,
  matrixFromCatalog,
  orderActions,
} from '@/utils/permissions';
import { usePermissionLabels } from '@/hooks/usePermissionLabels';

// The check state of a set of cells: all on, all off, or mixed.
function triState(values: boolean[]): boolean | 'indeterminate' {
  if (values.length > 0 && values.every(Boolean)) return true;
  if (values.some(Boolean)) return 'indeterminate';
  return false;
}

// Create or edit a role of a team in a right-hand side panel, over the team panel
// it was opened from. Escape or a backdrop click closes it. The permission matrix
// groups resources and offers quick toggles per column (all resources) and per
// group. On failure the reason is toasted globally and the panel stays open.
export default function RoleEditorPanel({
  teamId,
  role,
  catalog,
  onClose,
}: {
  teamId: number;
  role: Role | null;
  catalog: PermissionCatalog;
  onClose: () => void;
}) {
  const t = useTranslations('teams.roles');
  const tCommon = useTranslations('common');
  const { actionLabel, resourceLabel, groupLabel } = usePermissionLabels();
  const [name, setName] = useState(role?.name ?? '');
  const [matrix, setMatrix] = useState<Permissions>(() =>
    matrixFromCatalog(catalog, role?.permissions),
  );
  const createRole = useCreateRole(teamId);
  const updateRole = useUpdateRole(teamId);
  const busy = createRole.isPending || updateRole.isPending;

  useExitOnEscape(onClose);

  const supports = useMemo(() => catalogSupport(catalog), [catalog]);
  const resourceKeys = useMemo(() => catalog.resources.map((r) => r.key), [catalog.resources]);
  const groups = useMemo(() => groupResources(resourceKeys), [resourceKeys]);
  const actions = useMemo(() => orderActions(catalog.actions), [catalog.actions]);

  // Set `value` on every supported (resource, action) pair in the given sets.
  function apply(resources: PermissionResource[], actions: PermissionAction[], value: boolean) {
    setMatrix((m) => {
      const next = { ...m };
      for (const resource of resources) {
        next[resource] = { ...next[resource] };
        for (const action of actions) {
          if (supports(resource, action)) next[resource][action] = value;
        }
      }
      return next;
    });
  }

  const cellsFor = (resources: PermissionResource[], actions: PermissionAction[]) =>
    resources.flatMap((r) => actions.filter((a) => supports(r, a)).map((a) => matrix[r][a]));

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
      className="fixed inset-0 z-50 flex bg-black/20"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="ml-auto flex h-full w-full flex-col border-l bg-card sm:w-[680px] sm:max-w-[92vw]">
        <div className="flex shrink-0 items-center justify-between gap-3 bg-muted/30 px-6 py-4">
          <h2 className="min-w-0 truncate text-base font-semibold">
            {role ? t('editorTitleEdit') : t('editorTitleNew')}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onClose}
            title={tCommon('close')}
          >
            <X />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="role-name">{tCommon('name')}</Label>
            <Input
              id="role-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              className="h-9"
            />
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-2 text-left text-xs font-medium">{t('resourceColumn')}</th>
                {actions.map((action) => {
                  const state = triState(cellsFor(resourceKeys, [action]));
                  return (
                    <th key={action} className="px-1 py-2">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {actionLabel(action)}
                        </span>
                        <MatrixCheckbox
                          checked={state}
                          onCheckedChange={() => apply(resourceKeys, [action], state !== true)}
                          title={t('toggleActionAll', { action: actionLabel(action) })}
                          aria-label={t('toggleActionAll', { action: actionLabel(action) })}
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
                  <Fragment key={group.key}>
                    <tr className="border-b bg-muted/40">
                      <td className="py-1.5 pr-2">
                        <div className="flex items-center gap-2">
                          <MatrixCheckbox
                            checked={groupState}
                            onCheckedChange={() =>
                              apply(group.resources, actions, groupState !== true)
                            }
                            title={t('toggleGroupAll', { group: groupLabel(group.key) })}
                            aria-label={t('toggleGroupAll', { group: groupLabel(group.key) })}
                          />
                          <span className="text-xs font-medium">{groupLabel(group.key)}</span>
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
                              title={t('toggleActionGroup', {
                                action: actionLabel(action),
                                group: groupLabel(group.key),
                              })}
                              aria-label={t('toggleActionGroup', {
                                action: actionLabel(action),
                                group: groupLabel(group.key),
                              })}
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
                            {supports(resource, action) && (
                              <MatrixCheckbox
                                checked={matrix[resource][action]}
                                onCheckedChange={() =>
                                  apply([resource], [action], !matrix[resource][action])
                                }
                                aria-label={t('cellAria', {
                                  resource: resourceLabel(resource),
                                  action: actionLabel(action),
                                })}
                              />
                            )}
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
            {tCommon('cancel')}
          </Button>
          <Button onClick={save} disabled={busy || !name.trim()}>
            {role ? t('saveRole') : t('createRole')}
          </Button>
        </div>
      </div>
    </div>
  );
}
