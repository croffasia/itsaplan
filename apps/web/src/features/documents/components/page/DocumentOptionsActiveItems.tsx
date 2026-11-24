import type { ReactNode } from 'react';
import { Archive, FilePlus2, FolderInput, Lock, LockOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import DocumentStickyToolbarItem from './DocumentStickyToolbarItem';

// The page menu of a page that is not archived.
export default function DocumentOptionsActiveItems({
  locked,
  stickyToolbar,
  canEdit,
  canCreate,
  canManage,
  canManageLifecycle,
  busy,
  copyItem,
  pinItem,
  readItems,
  onStickyToolbarChange,
  onCreateChild,
  onMove,
  onLockChange,
  onArchive,
}: {
  locked: boolean;
  stickyToolbar: boolean;
  canEdit: boolean;
  canCreate: boolean;
  canManage: boolean;
  canManageLifecycle: boolean;
  busy: boolean;
  copyItem: ReactNode;
  pinItem: ReactNode;
  readItems: ReactNode;
  onStickyToolbarChange: (value: boolean) => void;
  onCreateChild: () => void;
  onMove: () => void;
  onLockChange: (locked: boolean) => void;
  onArchive: () => void;
}) {
  const t = useTranslations('documents');

  return (
    <>
      {canCreate && (
        <DropdownMenuItem onSelect={onCreateChild}>
          <FilePlus2 />
          {t('addSubpage')}
        </DropdownMenuItem>
      )}
      {copyItem}
      {canEdit && (
        // A locked page keeps the item hoverable, so its title says why it is off.
        <DropdownMenuItem
          disabled={busy}
          aria-disabled={locked || undefined}
          title={locked ? t('unlockToMove') : undefined}
          className={locked ? 'opacity-50' : undefined}
          onSelect={(event) => {
            if (locked) event.preventDefault();
            else onMove();
          }}
        >
          <FolderInput />
          {t('moveTo')}
        </DropdownMenuItem>
      )}
      {pinItem}
      {(canCreate || canEdit) && <DropdownMenuSeparator />}
      {readItems}
      {canManage && (
        <DropdownMenuItem disabled={busy} onSelect={() => onLockChange(!locked)}>
          {locked ? <LockOpen /> : <Lock />}
          {locked ? t('unlock') : t('lock')}
        </DropdownMenuItem>
      )}
      {canEdit && (
        <>
          <DropdownMenuSeparator />
          <DocumentStickyToolbarItem checked={stickyToolbar} onChange={onStickyToolbarChange} />
        </>
      )}
      {canManageLifecycle && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={busy || locked} onSelect={onArchive}>
            <Archive />
            {t('archive')}
          </DropdownMenuItem>
        </>
      )}
    </>
  );
}
