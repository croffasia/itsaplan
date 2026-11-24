import type { ReactNode } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

export default function DocumentOptionsArchivedItems({
  canCreate,
  canManageLifecycle,
  busy,
  copyItem,
  readItems,
  onRestore,
  onDelete,
}: {
  canCreate: boolean;
  canManageLifecycle: boolean;
  busy: boolean;
  copyItem: ReactNode;
  readItems: ReactNode;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('documents');

  return (
    <>
      {canManageLifecycle && (
        <DropdownMenuItem disabled={busy} onSelect={onRestore}>
          <RotateCcw />
          {t('restore')}
        </DropdownMenuItem>
      )}
      {copyItem}
      {(canManageLifecycle || canCreate) && <DropdownMenuSeparator />}
      {readItems}
      {canManageLifecycle && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={busy} onSelect={onDelete}>
            <Trash2 />
            {t('deletePermanently')}
          </DropdownMenuItem>
        </>
      )}
    </>
  );
}
