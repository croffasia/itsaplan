import { useState } from 'react';
import { Globe, Lock, MoreHorizontal, Pencil, Plus, StickyNote, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { MruEntry } from '../hooks/useNoteBoardMru';
import NoteBoardNameDialog from './NoteBoardNameDialog';
import BoardSwitcher from './BoardSwitcher';

// The notes header: a fixed "+" create button on the left edge, a strip of the
// recently-used boards as tabs, and a board switcher (searchable, paged) on the
// right. A personal board carries a lock; the active tab exposes rename, a
// public/personal toggle, and delete. The tab set is the MRU list from the host.
export default function NoteBoardBar({
  projectKey,
  tabs,
  activeBoardId,
  onSelect,
  onCreate,
  onRename,
  onToggleVisibility,
  onDelete,
}: {
  projectKey: string;
  tabs: MruEntry[];
  activeBoardId: number | null;
  onSelect: (id: number) => void;
  onCreate: (name: string, personal: boolean) => void;
  onRename: (id: number, name: string) => void;
  onToggleVisibility: (id: number, personal: boolean) => void;
  onDelete: (id: number) => void;
}) {
  // 'create' to open the new-board dialog, an MRU entry to rename, or null (closed).
  const [dialog, setDialog] = useState<'create' | MruEntry | null>(null);
  const renaming = dialog && typeof dialog === 'object' ? dialog : null;

  // A stable remount key for the name dialog so its input resets per open.
  function dialogKey() {
    if (renaming) return `rename-${renaming.id}`;
    return dialog === 'create' ? 'create' : 'closed';
  }

  return (
    <div className="flex items-center gap-1 border-b px-2 py-1.5 sm:px-3">
      <button
        type="button"
        aria-label="New board"
        onClick={() => setDialog('create')}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus className="size-4" />
      </button>

      <BoardSwitcher projectKey={projectKey} activeBoardId={activeBoardId} onSelect={onSelect} />

      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = activeBoardId === tab.id;
          return (
            <div
              key={tab.id}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm',
                active
                  ? 'bg-secondary font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(tab.id)}
                className="flex items-center gap-1.5"
              >
                {tab.personal ? <Lock className="size-3.5" /> : <StickyNote className="size-3.5" />}
                {tab.name}
              </button>
              {active && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label="Board options"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setDialog(tab)}>
                      <Pencil className="size-4" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onToggleVisibility(tab.id, !tab.personal)}>
                      {tab.personal ? (
                        <>
                          <Globe className="size-4" /> Make public
                        </>
                      ) : (
                        <>
                          <Lock className="size-4" /> Make private
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => onDelete(tab.id)}>
                      <Trash2 className="size-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
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
