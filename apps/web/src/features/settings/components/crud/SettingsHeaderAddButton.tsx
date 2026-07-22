'use client';

import { Plus } from 'lucide-react';
import type { PermissionResource } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';

// A settings page's primary "add" action for the page header, for sections whose
// create form is inline in the list rather than a dialog: the list owns the inline
// form, opened via lifted state. Gated on the section's
// create permission, so it hides for a user who cannot create.
export function SettingsHeaderAddButton({
  resource,
  label,
  onClick,
}: {
  resource: PermissionResource;
  label: string;
  onClick: () => void;
}) {
  const { can } = usePermissions();
  if (!can(resource, 'create')) return null;
  return (
    <Button size="sm" className="h-8 gap-1.5" onClick={onClick}>
      <Plus className="size-3.5" />
      {label}
    </Button>
  );
}
