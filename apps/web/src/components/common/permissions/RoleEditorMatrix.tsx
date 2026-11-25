'use client';

import { Fragment, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type {
  PermissionAction,
  PermissionCatalog,
  PermissionResource,
  Permissions,
} from '@/lib/api/endpoints/roles';
import { cn } from '@/lib/utils';
import { catalogSupport, groupResources, linkedActions } from '@/utils/permissions';
import { usePermissionLabels } from '@/hooks/usePermissionLabels';
import { MatrixCheckbox } from './MatrixCheckbox';

// The check state of a set of cells: all on, all off, or mixed.
function triState(values: boolean[]): boolean | 'indeterminate' {
  if (values.length > 0 && values.every(Boolean)) return true;
  if (values.some(Boolean)) return 'indeterminate';
  return false;
}

// The editable permission matrix: resources in groups, with quick toggles per column
// (all resources) and per group. The resources in `gaps` are marked.
export default function RoleEditorMatrix({
  catalog,
  matrix,
  gaps,
  onChange,
}: {
  catalog: PermissionCatalog;
  matrix: Permissions;
  gaps: PermissionResource[];
  onChange: (matrix: Permissions) => void;
}) {
  const t = useTranslations('permissions');
  const { actionLabel, resourceLabel, groupLabel } = usePermissionLabels();
  const { actions } = catalog;
  const supports = useMemo(() => catalogSupport(catalog), [catalog]);
  const resourceKeys = useMemo(() => catalog.resources.map((r) => r.key), [catalog.resources]);
  const groups = useMemo(
    () => groupResources(resourceKeys, catalog.resources),
    [resourceKeys, catalog.resources],
  );

  // Set `value` on every supported (resource, action) pair in the given sets.
  function apply(resources: PermissionResource[], actions: PermissionAction[], value: boolean) {
    const next = { ...matrix };
    for (const resource of resources) {
      next[resource] = { ...next[resource] };
      for (const action of actions) {
        if (supports(resource, action)) next[resource][action] = value;
      }
    }
    onChange(next);
  }

  // Switch one column over the given resources, with the columns linked to it. A resource
  // without that column follows in the linked ones.
  function toggle(resources: PermissionResource[], action: PermissionAction, value: boolean) {
    apply(resources, linkedActions(actions, action, value), value);
  }

  const cellsFor = (resources: PermissionResource[], actions: PermissionAction[]) =>
    resources.flatMap((r) => actions.filter((a) => supports(r, a)).map((a) => matrix[r][a]));

  return (
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
                    onCheckedChange={() => toggle(resourceKeys, action, state !== true)}
                    title={t('editor.toggleActionAll', { action: actionLabel(action) })}
                    aria-label={t('editor.toggleActionAll', { action: actionLabel(action) })}
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
                      onCheckedChange={() => apply(group.resources, actions, groupState !== true)}
                      title={t('editor.toggleGroupAll', { group: groupLabel(group.key) })}
                      aria-label={t('editor.toggleGroupAll', {
                        group: groupLabel(group.key),
                      })}
                    />
                    <span className="text-xs font-medium">{groupLabel(group.key)}</span>
                  </div>
                </td>
                {actions.map((action) => {
                  const cells = cellsFor(group.resources, [action]);
                  const state = triState(cells);
                  return (
                    <td key={action} className="px-1 py-1.5 text-center">
                      {cells.length > 0 && (
                        <MatrixCheckbox
                          checked={state}
                          onCheckedChange={() => toggle(group.resources, action, state !== true)}
                          title={t('editor.toggleActionGroup', {
                            action: actionLabel(action),
                            group: groupLabel(group.key),
                          })}
                          aria-label={t('editor.toggleActionGroup', {
                            action: actionLabel(action),
                            group: groupLabel(group.key),
                          })}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
              {group.resources.map((resource) => (
                <tr
                  key={resource}
                  className={cn(
                    'border-b last:border-b-0',
                    gaps.includes(resource) && 'bg-warning/10',
                  )}
                >
                  <td className="py-2 pr-2 pl-6">{resourceLabel(resource)}</td>
                  {actions.map((action) => (
                    <td key={action} className="px-1 py-2 text-center">
                      {supports(resource, action) && (
                        <MatrixCheckbox
                          checked={matrix[resource][action]}
                          onCheckedChange={() =>
                            toggle([resource], action, !matrix[resource][action])
                          }
                          aria-label={t('editor.cellAria', {
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
  );
}
