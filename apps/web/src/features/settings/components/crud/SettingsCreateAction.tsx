'use client';

import { useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import type { PermissionResource } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';

// A settings page's primary "add" action, rendered in the page header. Owns the
// create-dialog open state and gates itself on the section's create permission
// (hidden when the user cannot create). Used in a SectionPageView's `actions` slot.
export function SettingsCreateAction({
  resource,
  label,
  children,
}: {
  resource: PermissionResource;
  label: string;
  children: (state: { open: boolean; close: () => void }) => ReactNode;
}) {
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);

  if (!can(resource, 'create')) return null;

  return (
    <>
      <Button size="sm" className="h-8 gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" />
        {label}
      </Button>
      {children({ open, close: () => setOpen(false) })}
    </>
  );
}
