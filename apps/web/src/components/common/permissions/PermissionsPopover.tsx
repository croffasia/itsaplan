'use client';

import { Fragment } from 'react';
import { Check, ListChecks } from 'lucide-react';
import type { PermissionResource, Permissions } from '@/lib/api';
import { ACTION_ORDER, actionLabel, groupResources, resourceLabel } from '@/utils/permissions';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// `label` overrides the trigger's tooltip and aria-label.
export function PermissionsPopover({
  permissions,
  label = 'View permissions',
}: {
  permissions: Permissions;
  label?: string;
}) {
  const resources = Object.keys(permissions) as PermissionResource[];
  const total = resources.reduce(
    (sum, r) => sum + ACTION_ORDER.filter((a) => permissions[r]?.[a]).length,
    0,
  );

  if (total === 0)
    return <span className="text-xs text-muted-foreground">No permissions granted</span>;

  const groups = groupResources(resources);

  return (
    <div className="flex items-center gap-1.5">
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                aria-label={label}
              >
                <ListChecks className="size-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
        <PopoverContent align="start" className="max-h-96 w-[22rem] overflow-auto p-0">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-popover">
              <tr className="border-b border-border/50">
                <th className="py-2 pr-2 pl-3 text-left font-medium text-muted-foreground" />
                {ACTION_ORDER.map((a) => (
                  <th key={a} className="px-2 py-2 text-center font-medium text-muted-foreground">
                    {actionLabel(a)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.title}>
                  <tr>
                    <td
                      colSpan={ACTION_ORDER.length + 1}
                      className="px-3 pt-3 pb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
                    >
                      {g.title}
                    </td>
                  </tr>
                  {g.resources.map((r) => (
                    <tr key={r} className="border-b border-border/30 last:border-0">
                      <td className="py-1.5 pr-2 pl-3">{resourceLabel(r)}</td>
                      {ACTION_ORDER.map((a) => (
                        <td key={a} className="px-2 py-1.5 text-center">
                          {permissions[r]?.[a] ? (
                            <Check className="mx-auto size-3.5 text-foreground" />
                          ) : (
                            <span className="text-muted-foreground/30">·</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </PopoverContent>
      </Popover>
      <span className="text-xs text-muted-foreground">
        {total} permission{total === 1 ? '' : 's'} granted
      </span>
    </div>
  );
}
