'use client';

import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { PermissionCatalog, Permissions } from '@/lib/api';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import GodPermissionMatrix from './GodPermissionMatrix';

// Where the permissions on show come from, in words. An owner bypasses the matrix
// entirely, so its rows are all on and this says why.
function sourceLabel(isOwner: boolean, roleName: string | null): string {
  if (isOwner) return 'An owner has full access: the role matrix is not consulted.';
  if (roleName) return `Resolved from the "${roleName}" role.`;
  return 'No role assigned: the default member permissions apply.';
}

// One membership, from either side of it: a project the user can reach, or a member
// of the project. `header` is what the row states about that side; the matrix behind
// the toggle spells the access out per resource.
export default function GodAccessCard({
  header,
  isOwner,
  roleName,
  permissions,
  catalog,
}: {
  header: ReactNode;
  isOwner: boolean;
  roleName: string | null;
  permissions: Permissions;
  catalog: PermissionCatalog | undefined;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="overflow-hidden rounded-lg bg-muted/40"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/70">
        <ChevronRight
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
        />
        {header}
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t border-border/50 bg-background/40 px-3 py-3">
        <p className="mb-2 text-xs text-muted-foreground">{sourceLabel(isOwner, roleName)}</p>
        {catalog ? (
          <GodPermissionMatrix catalog={catalog} permissions={permissions} />
        ) : (
          <p className="text-xs text-muted-foreground">Loading permissions…</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
