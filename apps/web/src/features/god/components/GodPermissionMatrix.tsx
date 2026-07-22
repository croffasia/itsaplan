'use client';

import { Fragment, useMemo } from 'react';
import { Check, Minus } from 'lucide-react';
import type { PermissionCatalog, Permissions } from '@/lib/api';
import { actionLabel, groupResources, orderActions, resourceLabel } from '@/utils/permissions';

// A read-only permission matrix: resources down, actions across, a check where the
// membership grants it. The role editor owns the editable version; this one only
// reports what a user's access resolves to, so it renders icons, not checkboxes.
export default function GodPermissionMatrix({
  catalog,
  permissions,
}: {
  catalog: PermissionCatalog;
  permissions: Permissions;
}) {
  const groups = useMemo(() => groupResources(catalog.resources), [catalog.resources]);
  const actions = useMemo(() => orderActions(catalog.actions), [catalog.actions]);

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b">
          <th className="py-1.5 pr-2 text-left text-[11px] font-medium text-muted-foreground">
            Resource
          </th>
          {actions.map((action) => (
            <th
              key={action}
              className="px-1 py-1.5 text-center text-[11px] font-medium text-muted-foreground"
            >
              {actionLabel(action)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {groups.map((group) => (
          <Fragment key={group.title}>
            <tr className="border-b bg-muted/40">
              <td className="py-1 pr-2 text-xs font-medium" colSpan={actions.length + 1}>
                {group.title}
              </td>
            </tr>
            {group.resources.map((resource) => (
              <tr key={resource} className="border-b last:border-b-0">
                <td className="py-1.5 pr-2 pl-4 text-xs">{resourceLabel(resource)}</td>
                {actions.map((action) => (
                  <td key={action} className="px-1 py-1.5 text-center">
                    {permissions[resource]?.[action] ? (
                      <Check className="mx-auto size-3.5 text-primary" aria-label="allowed" />
                    ) : (
                      <Minus
                        className="mx-auto size-3.5 text-muted-foreground/40"
                        aria-label="not allowed"
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
