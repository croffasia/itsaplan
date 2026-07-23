'use client';

import { useState } from 'react';
import { Archive, Bot, CircleDashed, Tag, Target, Trash2, User, X } from 'lucide-react';
import { type ProjectDetail } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { useInitiativesQuery } from '@/services/initiatives.service';
import { LINKABLE_STATUSES } from '@/utils/initiativeMeta';
import { cn } from '@/lib/utils';
import { colorDot } from '@/components/common/fields/colorDot';
import { PRIORITY_FIELDS } from '@/components/common/fields/priorityFields';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { StateIcon } from '@/features/issue/components/shared/IssueIcons';
import { useSelection } from '../../context/useSelection';
import { useBulkActions } from '../../hooks/useBulkActions';
import { BarMenu } from './BarMenu';

// Floating bar shown while the kanban board is in selection mode. Each control
// applies one field to every selected issue at once; archive and delete run their
// respective bulk mutations. Selection is kept after a field edit (the applied
// change stays visible and further edits can be chained) and self-empties after
// archive/delete as those issues leave the board.
export function BulkActionBar({ project }: { project: ProjectDetail }) {
  const selection = useSelection();
  const { can } = usePermissions();
  const bulk = useBulkActions(project);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Initiatives are not in the board scaffold. The bulk picker fetches the first
  // page of linkable (open) initiatives only while selection is active.
  const { data } = useInitiativesQuery(selection.isSelecting ? project.project.key : null, {
    statuses: LINKABLE_STATUSES,
    pageSize: 50,
  });
  const initiatives = data?.items ?? [];

  if (!selection.isSelecting) return null;

  const ids = [...selection.selected];
  const canEdit = can('work_items', 'edit');
  const canDelete = can('work_items', 'delete');
  const members = project.assignees.filter((a) => a.kind === 'member');
  const agents = project.assignees.filter((a) => a.kind === 'agent');
  const disabled = bulk.pending;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
        <div
          className={cn(
            'pointer-events-auto flex items-center gap-1 rounded-lg border bg-popover p-1 pl-3 shadow-lg',
            disabled && 'opacity-70',
          )}
        >
          <span className="pr-1 text-sm font-medium whitespace-nowrap">{ids.length} selected</span>

          {canEdit && (
            <>
              <div className="mx-1 h-5 w-px bg-border" />

              <BarMenu
                icon={<CircleDashed className="size-4" />}
                label="Status"
                disabled={disabled}
              >
                {project.columns.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onSelect={() => void bulk.patch(ids, { columnId: c.id })}
                  >
                    <StateIcon stateType={c.stateType} color={c.color} className="size-3.5" />
                    <span className="truncate">{c.name}</span>
                  </DropdownMenuItem>
                ))}
              </BarMenu>

              <BarMenu icon={PRIORITY_FIELDS[0].icon} label="Priority" disabled={disabled}>
                {PRIORITY_FIELDS.map((p) => (
                  <DropdownMenuItem
                    key={p.value || 'none'}
                    onSelect={() => void bulk.patch(ids, { priority: p.value || null })}
                  >
                    {p.icon}
                    <span className="flex-1">{p.label}</span>
                  </DropdownMenuItem>
                ))}
              </BarMenu>

              {members.length > 0 && (
                <BarMenu icon={<User className="size-4" />} label="Assignee" disabled={disabled}>
                  <DropdownMenuItem onSelect={() => void bulk.patch(ids, { assigneeUserId: null })}>
                    <CircleDashed />
                    <span className="flex-1">No assignee</span>
                  </DropdownMenuItem>
                  {members.map((a) => (
                    <DropdownMenuItem
                      key={a.userId}
                      onSelect={() => void bulk.patch(ids, { assigneeUserId: a.userId })}
                    >
                      <User />
                      <span className="flex-1 truncate">{a.name}</span>
                    </DropdownMenuItem>
                  ))}
                </BarMenu>
              )}

              {agents.length > 0 && (
                <BarMenu icon={<Bot className="size-4" />} label="Delegate" disabled={disabled}>
                  <DropdownMenuItem onSelect={() => void bulk.patch(ids, { delegateUserId: null })}>
                    <CircleDashed />
                    <span className="flex-1">No delegate</span>
                  </DropdownMenuItem>
                  {agents.map((a) => (
                    <DropdownMenuItem
                      key={a.userId}
                      onSelect={() => void bulk.patch(ids, { delegateUserId: a.userId })}
                    >
                      <Bot />
                      <span className="flex-1 truncate">{a.name}</span>
                    </DropdownMenuItem>
                  ))}
                </BarMenu>
              )}

              {initiatives.length > 0 && (
                <BarMenu
                  icon={<Target className="size-4" />}
                  label="Initiative"
                  disabled={disabled}
                >
                  <DropdownMenuItem onSelect={() => void bulk.patch(ids, { initiativeId: null })}>
                    <CircleDashed />
                    <span className="flex-1">No initiative</span>
                  </DropdownMenuItem>
                  {initiatives.map((initiative) => (
                    <DropdownMenuItem
                      key={initiative.id}
                      onSelect={() => void bulk.patch(ids, { initiativeId: initiative.id })}
                    >
                      <Target />
                      <span className="flex-1 truncate">{initiative.title}</span>
                    </DropdownMenuItem>
                  ))}
                </BarMenu>
              )}

              {project.labels.length > 0 && (
                <BarMenu icon={<Tag className="size-4" />} label="Labels" disabled={disabled}>
                  {project.labels.map((l) => (
                    <DropdownMenuItem
                      key={l.id}
                      // Keep the menu open so several labels can be added in one pass.
                      onSelect={(e) => {
                        e.preventDefault();
                        void bulk.addLabel(ids, l.id);
                      }}
                    >
                      {colorDot(l.color)}
                      <span className="flex-1 truncate">{l.name}</span>
                    </DropdownMenuItem>
                  ))}
                </BarMenu>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2"
                disabled={disabled}
                onClick={() => void bulk.archiveAll(ids)}
              >
                <Archive className="size-4" />
                Archive
              </Button>
            </>
          )}

          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-destructive hover:text-destructive"
              disabled={disabled}
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          )}

          <div className="mx-1 h-5 w-px bg-border" />

          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            onClick={selection.clear}
            title="Clear selection"
          >
            <X />
          </Button>
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete issues"
          confirmLabel={`Delete ${ids.length} issues`}
          onConfirm={async () => {
            await bulk.deleteAll(ids);
            setConfirmingDelete(false);
          }}
          onClose={() => setConfirmingDelete(false)}
        >
          <p className="text-sm text-muted-foreground">
            Delete {ids.length} selected issues? This removes them, their comments, activity and
            attachments. This cannot be undone.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
