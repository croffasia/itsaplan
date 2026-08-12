'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import type { MruEntry } from '../hooks/useNoteBoardMru';
import type { NewBoardVisibility } from '../utils/visibility';
import NoteBoardNameDialog from './NoteBoardNameDialog';
import NoteBoardTab from './NoteBoardTab';
import BoardSwitcher from './BoardSwitcher';

// The notes header. The tab set is the MRU list from the host.
export default function NoteBoardBar({
  projectKey,
  tabs,
  activeBoardId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  projectKey: string;
  tabs: MruEntry[];
  activeBoardId: number | null;
  onSelect: (id: number) => void;
  onCreate: (name: string, visibility: NewBoardVisibility) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
}) {
  // 'create' to open the new-board dialog, an MRU entry to rename, or null (closed).
  const [dialog, setDialog] = useState<'create' | MruEntry | null>(null);
  const t = useTranslations('notes');
  const renaming = dialog && typeof dialog === 'object' ? dialog : null;
  const { can } = usePermissions();
  const canCreate = can('note_boards', 'create');

  // A stable remount key for the name dialog so its input resets per open.
  function dialogKey() {
    if (renaming) return `rename-${renaming.id}`;
    return dialog === 'create' ? 'create' : 'closed';
  }

  return (
    <div className="flex items-center gap-1 border-b px-2 py-1.5 sm:px-3">
      {canCreate && (
        <button
          type="button"
          aria-label={t('newBoard')}
          onClick={() => setDialog('create')}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
      )}

      <BoardSwitcher projectKey={projectKey} activeBoardId={activeBoardId} onSelect={onSelect} />

      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <NoteBoardTab
            key={tab.id}
            tab={tab}
            active={activeBoardId === tab.id}
            onSelect={() => onSelect(tab.id)}
            onRename={() => setDialog(tab)}
            onDelete={() => onDelete(tab.id)}
          />
        ))}
      </div>

      <NoteBoardNameDialog
        key={dialogKey()}
        open={dialog != null}
        title={renaming ? t('renameBoard') : t('newBoard')}
        description={renaming ? undefined : t('newBoardDescription')}
        projectKey={projectKey}
        initial={renaming?.name ?? ''}
        withVisibility={dialog === 'create'}
        onClose={() => setDialog(null)}
        onSubmit={(name, visibility) => {
          if (renaming) onRename(renaming.id, name);
          else onCreate(name, visibility);
          setDialog(null);
        }}
      />
    </div>
  );
}
