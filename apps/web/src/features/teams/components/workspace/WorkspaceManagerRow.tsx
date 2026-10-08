'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { WorkspaceManager } from '@/lib/api/endpoints/workspaces';
import Avatar from '@/components/common/Avatar';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';

// `onRemove` is set only for an admin the reader, the owner, may remove.
export default function WorkspaceManagerRow({
  manager,
  onRemove,
}: {
  manager: WorkspaceManager;
  onRemove?: (manager: WorkspaceManager) => void;
}) {
  const t = useTranslations('teams.workspace');
  const displayName = manager.name || manager.email;

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell className="px-3 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar
            name={displayName}
            image={manager.image}
            className="size-8 shrink-0 text-[11px]"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{manager.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-3 py-3 text-sm text-muted-foreground">
        {t(`roles.${manager.role}`)}
      </TableCell>
      <TableCell className="px-3 py-2">
        {onRemove && (
          <div className="flex items-center justify-end">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-destructive"
              title={t('managers.removeAction')}
              onClick={() => onRemove(manager)}
            >
              <X className="size-4" />
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
