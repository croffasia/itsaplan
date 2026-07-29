import { useState } from 'react';
import { Plus } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import type { MruEntry } from '../hooks/useNoteBoardMru';
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
  onToggleVisibility,
  onDelete,
  canMakeActivePrivate,
}: {
  projectKey: string;
  tabs: MruEntry[];
  activeBoardId: number | null;
  onSelect: (id: number) => void;
  onCreate: (name: string, personal: boolean) => void;
  onRename: (id: number, name: string) => void;
  onToggleVisibility: (id: number, personal: boolean) => void;
  onDelete: (id: number) => void;
  canMakeActivePrivate: boolean;
}) {
  // 'create' to open the new-board dialog, an MRU entry to rename, or null (closed).
  const [dialog, setDialog] = useState<'create' | MruEntry | null>(null);
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
          aria-label="New board"
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
            canMakePrivate={canMakeActivePrivate}
            onSelect={() => onSelect(tab.id)}
            onRename={() => setDialog(tab)}
            onToggleVisibility={() => onToggleVisibility(tab.id, !tab.personal)}
            onDelete={() => onDelete(tab.id)}
          />
        ))}
      </div>

      <NoteBoardNameDialog
        key={dialogKey()}
        open={dialog != null}
        title={renaming ? 'Rename board' : 'New board'}
        description={renaming ? undefined : 'A freeform canvas for sticky notes.'}
        projectKey={projectKey}
        initial={renaming?.name ?? ''}
        withVisibility={dialog === 'create'}
        onClose={() => setDialog(null)}
        onSubmit={(name, personal) => {
          if (renaming) onRename(renaming.id, name);
          else onCreate(name, personal);
          setDialog(null);
        }}
      />
    </div>
  );
}
