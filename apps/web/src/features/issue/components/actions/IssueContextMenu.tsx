import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  Archive,
  ArchiveRestore,
  Bot,
  CalendarClock,
  Check,
  CircleDashed,
  ClipboardCopy,
  PanelRight,
  SquareArrowOutUpRight,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { ActionDef, ProjectDetail, Issue, IssuePatch } from '@/lib/api';
import { actionIcon } from '@/utils/actionIcons';
import { useActionsQuery } from '@/services/actions.service';
import { useArchiveIssue, useRestoreIssue, useUpdateIssue } from '@/services/issues.service';
import { usePermissions } from '@/hooks/usePermissions';
import { useShell } from '@/context/shellContext';
import { ApplyActionDialog, DeleteIssueDialog, matchedActions } from './IssueActions';
import { buildIssuePrompt } from '../../utils/issuePrompt';
import { useSession } from '@/lib/auth-client';
import { toDateStr } from '@/utils/dates';
import { colorDot } from '@/components/common/fields/colorDot';
import { PRIORITY_FIELDS } from '@/components/common/fields/priorityFields';
import { StateIcon } from '../shared/IssueIcons';
import { dueDatePresets, formatPreset } from '../../utils/dueDatePresets';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

// Trailing check on the currently-selected row in a single-select submenu.
function SelectedCheck({ selected }: { selected: boolean }) {
  return selected ? <Check className="ml-auto size-4" /> : null;
}

// Wraps a issue card/row (any single element) so a right-click opens a context
// menu that changes its status, priority, assignee, labels or due date, or
// deletes it. Shared by every project view (Kanban, Table, Calendar, Timeline).
// onDeleted lets a host that is showing this one issue (the detail panel/page)
// leave after deletion; the project views leave it unset — the card just
// disappears when the project cache updates.
export default function IssueContextMenu({
  project,
  issue,
  onDeleted,
  children,
}: {
  project: ProjectDetail;
  issue: Issue;
  onDeleted?: () => void;
  children: ReactNode;
}) {
  const { can } = usePermissions();
  const { onOpenIssue } = useShell();
  const { data: session } = useSession();
  const canEdit = can('work_items', 'edit');
  const canDelete = can('work_items', 'delete');
  const updateIssue = useUpdateIssue(project.project.key);
  const archiveIssue = useArchiveIssue(project.project.key);
  const restoreIssue = useRestoreIssue(project.project.key);
  const actionsQuery = useActionsQuery(project.project.key);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingAction, setConfirmingAction] = useState<ActionDef | null>(null);

  const actions = matchedActions(actionsQuery.data ?? [], project, issue);

  function patch(fields: IssuePatch) {
    updateIssue.mutate({ id: issue.id, patch: fields });
  }

  function toggleLabel(id: number) {
    const next = issue.labelIds.includes(id)
      ? issue.labelIds.filter((x) => x !== id)
      : [...issue.labelIds, id];
    patch({ labelIds: next });
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(buildIssuePrompt(issue, project, session?.user));
    toast.success('Prompt copied to clipboard');
  }

  const currentColumn = project.columns.find((c) => c.id === issue.columnId);
  const currentPriority =
    PRIORITY_FIELDS.find((p) => p.value === (issue.priority ?? '')) ?? PRIORITY_FIELDS[0];
  const members = project.assignees.filter((a) => a.kind === 'member');
  const agents = project.assignees.filter((a) => a.kind === 'agent');

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {/* Both ways to open the issue, regardless of the account's default
              open mode. Reading an issue needs no permission. */}
          <ContextMenuItem onSelect={() => onOpenIssue(issue.id, 'panel')}>
            <PanelRight />
            Preview
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onOpenIssue(issue.id, 'page')}>
            <SquareArrowOutUpRight />
            Go to issue
          </ContextMenuItem>

          <ContextMenuSeparator />

          {canEdit && (
            <>
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  {currentColumn ? (
                    <StateIcon
                      stateType={currentColumn.stateType}
                      color={currentColumn.color}
                      className="size-3.5"
                    />
                  ) : (
                    <CircleDashed />
                  )}
                  Status
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-56">
                  {project.columns.map((c) => (
                    <ContextMenuItem key={c.id} onSelect={() => patch({ columnId: c.id })}>
                      <StateIcon stateType={c.stateType} color={c.color} className="size-3.5" />
                      <span className="truncate">{c.name}</span>
                      <SelectedCheck selected={c.id === issue.columnId} />
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>

              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  {currentPriority.icon}
                  Priority
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-52">
                  {PRIORITY_FIELDS.map((p) => (
                    <ContextMenuItem
                      key={p.value || 'none'}
                      onSelect={() => patch({ priority: p.value || null })}
                    >
                      {p.icon}
                      <span className="flex-1">{p.label}</span>
                      <SelectedCheck selected={p.value === (issue.priority ?? '')} />
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>

              {members.length > 0 && (
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    <User />
                    Assignee
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-56">
                    <ContextMenuItem onSelect={() => patch({ assigneeUserId: null })}>
                      <CircleDashed />
                      <span className="flex-1">No assignee</span>
                      <SelectedCheck selected={issue.assigneeUserId == null} />
                    </ContextMenuItem>
                    {members.map((a) => (
                      <ContextMenuItem
                        key={a.userId}
                        onSelect={() => patch({ assigneeUserId: a.userId })}
                      >
                        <User />
                        <span className="flex-1 truncate">{a.name}</span>
                        <SelectedCheck selected={a.userId === issue.assigneeUserId} />
                      </ContextMenuItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
              )}

              {agents.length > 0 && (
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    <Bot />
                    Delegate
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-56">
                    <ContextMenuItem onSelect={() => patch({ delegateUserId: null })}>
                      <CircleDashed />
                      <span className="flex-1">No delegate</span>
                      <SelectedCheck selected={issue.delegateUserId == null} />
                    </ContextMenuItem>
                    {agents.map((a) => (
                      <ContextMenuItem
                        key={a.userId}
                        onSelect={() => patch({ delegateUserId: a.userId })}
                      >
                        <Bot />
                        <span className="flex-1 truncate">{a.name}</span>
                        <SelectedCheck selected={a.userId === issue.delegateUserId} />
                      </ContextMenuItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
              )}

              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <CalendarClock />
                  Due date
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-72">
                  {dueDatePresets().map((p) => (
                    <ContextMenuItem
                      key={p.key}
                      onSelect={() => patch({ dueDate: toDateStr(p.date) })}
                    >
                      <CalendarClock />
                      <span className="whitespace-nowrap">{p.label}</span>
                      <ContextMenuShortcut className="whitespace-nowrap">
                        {formatPreset(p.date)}
                      </ContextMenuShortcut>
                    </ContextMenuItem>
                  ))}
                  {issue.dueDate && (
                    <>
                      <ContextMenuSeparator />
                      <ContextMenuItem onSelect={() => patch({ dueDate: null })}>
                        <X />
                        Clear due date
                      </ContextMenuItem>
                    </>
                  )}
                </ContextMenuSubContent>
              </ContextMenuSub>

              {project.labels.length > 0 && (
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    <Tag />
                    Labels
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-56">
                    {project.labels.map((l) => (
                      <ContextMenuItem
                        key={l.id}
                        // Keep the menu open so several labels can be toggled in one pass.
                        onSelect={(e) => {
                          e.preventDefault();
                          toggleLabel(l.id);
                        }}
                      >
                        {colorDot(l.color)}
                        <span className="flex-1 truncate">{l.name}</span>
                        <SelectedCheck selected={issue.labelIds.includes(l.id)} />
                      </ContextMenuItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
              )}

              {actions.length > 0 && (
                <>
                  <ContextMenuSeparator />
                  {actions.map((a) => {
                    const Icon = actionIcon(a.icon);
                    return (
                      <ContextMenuItem key={a.id} onSelect={() => setConfirmingAction(a)}>
                        <Icon />
                        <span className="truncate">{a.name}</span>
                      </ContextMenuItem>
                    );
                  })}
                </>
              )}
            </>
          )}

          {canEdit && <ContextMenuSeparator />}

          {/* Copy the issue as a Markdown prompt for an AI coding agent. Available
              to everyone — it only reads the issue, so no permission gate. */}
          <ContextMenuItem onSelect={copyPrompt}>
            <ClipboardCopy />
            Copy Prompt
          </ContextMenuItem>

          {canEdit && <ContextMenuSeparator />}

          {/* Archiving hides the issue from the board but keeps it; restore brings it back. */}
          {canEdit &&
            (issue.archivedAt ? (
              <ContextMenuItem onSelect={() => restoreIssue.mutate(issue.id)}>
                <ArchiveRestore />
                Restore
              </ContextMenuItem>
            ) : (
              <ContextMenuItem
                onSelect={() => {
                  archiveIssue.mutate(issue.id);
                  onDeleted?.();
                }}
              >
                <Archive />
                Archive
              </ContextMenuItem>
            ))}

          {canDelete && <ContextMenuSeparator />}

          {canDelete && (
            <ContextMenuItem variant="destructive" onSelect={() => setConfirmingDelete(true)}>
              <Trash2 />
              Delete
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {confirmingDelete && (
        <DeleteIssueDialog
          project={project}
          issue={issue}
          onClose={() => setConfirmingDelete(false)}
          onDeleted={onDeleted}
        />
      )}

      {confirmingAction && (
        <ApplyActionDialog
          project={project}
          issue={issue}
          action={confirmingAction}
          onClose={() => setConfirmingAction(null)}
        />
      )}
    </>
  );
}
