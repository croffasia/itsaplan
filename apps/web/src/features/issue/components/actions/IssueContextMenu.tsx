import { useContext, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useFormatter, useTranslations } from 'next-intl';
import {
  Archive,
  ArchiveRestore,
  Bot,
  CalendarClock,
  Check,
  CircleDashed,
  ClipboardCopy,
  PanelRight,
  RefreshCw,
  SquareArrowOutUpRight,
  Tag,
  Target,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { ActionDef, ProjectDetail, Issue, IssuePatch } from '@/lib/api';
import { actionIcon } from '@/utils/actionIcons';
import { useActionsQuery } from '@/services/actions.service';
import { useRestoreIssue, useUpdateIssue } from '@/services/issues.service';
import { useInitiativeOptionsQuery } from '@/services/initiatives.service';
import { STATUS_META } from '@/utils/initiativeMeta';
import { CYCLE_STATUS_META } from '@/utils/cycleMeta';
import { usePermissions } from '@/hooks/usePermissions';
import { usePriorityLabel } from '@/hooks/usePriorityLabel';
import { ShellCtx } from '@/context/shellContext';
import { useArchiveAction } from '../../hooks/useArchiveAction';
import { ApplyActionDialog, DeleteIssueDialog, matchedActions } from './IssueActions';
import { buildIssuePrompt } from '../../utils/issuePrompt';
import { delegatableAgents } from '../../utils/delegates';
import { useSession } from '@/lib/auth-client';
import { toDateStr } from '@/utils/dates';
import { colorDot } from '@/components/common/fields/colorDot';
import { PRIORITY_FIELDS } from '@/components/common/fields/priorityFields';
import { StateIcon } from '../shared/IssueIcons';
import { dueDatePresets } from '../../utils/dueDatePresets';
import { useDueDatePresetLabel } from '../../hooks/useDueDatePresetLabel';
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
// menu that changes its status, priority, assignee, initiative, cycle, labels or
// due date, or deletes it. Shared by every project view (Kanban, Table, Calendar, Timeline).
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
  const t = useTranslations('issue.menu');
  const format = useFormatter();
  const tCommon = useTranslations('common');
  const { can } = usePermissions();
  // Read the Shell directly (not useShell) so this can render outside it: on the
  // public read-only board there is no Shell, and the card is shown without a menu.
  const shell = useContext(ShellCtx);
  const { data: session } = useSession();
  const canEdit = can('work_items', 'edit');
  const canDelete = can('work_items', 'delete');
  const updateIssue = useUpdateIssue(project.project.key);
  const { archive, dialog: archiveDialog } = useArchiveAction(project, onDeleted);
  const restoreIssue = useRestoreIssue(project.project.key);
  const actionsQuery = useActionsQuery(project.project.key);
  const priorityLabel = usePriorityLabel();
  const presetLabel = useDueDatePresetLabel();
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingAction, setConfirmingAction] = useState<ActionDef | null>(null);
  // Initiatives are not in the board scaffold, so they are fetched here — only
  // while this menu is open, as every card on the board mounts one.
  const initiativesQuery = useInitiativeOptionsQuery(
    open && project.project.initiativesEnabled ? project.project.key : null,
  );

  // No Shell (public share): render the card as-is, without the right-click menu.
  if (!shell) return <>{children}</>;
  const onOpenIssue = shell.onOpenIssue;

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
    toast.success(t('promptCopied'));
  }

  const currentColumn = project.columns.find((c) => c.id === issue.columnId);
  const currentPriority =
    PRIORITY_FIELDS.find((p) => p.value === (issue.priority ?? '')) ?? PRIORITY_FIELDS[0];
  const members = project.assignees.filter((a) => a.kind === 'member');
  const agents = delegatableAgents(project.assignees, session?.user.id ?? null);
  const initiatives = initiativesQuery.data ?? [];

  return (
    <>
      <ContextMenu onOpenChange={setOpen}>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {/* Both ways to open the issue, regardless of the account's default
              open mode. Reading an issue needs no permission. */}
          <ContextMenuItem onSelect={() => onOpenIssue(issue.id, 'panel')}>
            <PanelRight />
            {t('preview')}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onOpenIssue(issue.id, 'page')}>
            <SquareArrowOutUpRight />
            {t('goToIssue')}
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
                  {t('status')}
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
                  {t('priority')}
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-52">
                  {PRIORITY_FIELDS.map((p) => (
                    <ContextMenuItem
                      key={p.value || 'none'}
                      onSelect={() => patch({ priority: p.value || null })}
                    >
                      {p.icon}
                      <span className="flex-1">{priorityLabel(p.value)}</span>
                      <SelectedCheck selected={p.value === (issue.priority ?? '')} />
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>

              {members.length > 0 && (
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    <User />
                    {t('assignee')}
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-56">
                    <ContextMenuItem onSelect={() => patch({ assigneeUserId: null })}>
                      <CircleDashed />
                      <span className="flex-1">{t('noAssignee')}</span>
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
                    {t('delegate')}
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-56">
                    <ContextMenuItem onSelect={() => patch({ delegateUserId: null })}>
                      <CircleDashed />
                      <span className="flex-1">{t('noDelegate')}</span>
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

              {project.project.initiativesEnabled && (
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    {issue.initiative ? <Target /> : <CircleDashed />}
                    {t('initiative')}
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-56">
                    <ContextMenuItem onSelect={() => patch({ initiativeId: null })}>
                      <CircleDashed />
                      <span className="flex-1">{t('noInitiative')}</span>
                      <SelectedCheck selected={issue.initiative == null} />
                    </ContextMenuItem>
                    {initiatives.map((it) => (
                      <ContextMenuItem key={it.id} onSelect={() => patch({ initiativeId: it.id })}>
                        {colorDot(STATUS_META[it.status].color)}
                        <span className="flex-1 truncate">{it.title}</span>
                        <SelectedCheck selected={it.id === issue.initiative?.id} />
                      </ContextMenuItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
              )}

              {project.project.cyclesEnabled && (
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    {issue.cycle ? <RefreshCw /> : <CircleDashed />}
                    {t('cycle')}
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-56">
                    <ContextMenuItem onSelect={() => patch({ cycleId: null })}>
                      <CircleDashed />
                      <span className="flex-1">{t('noCycle')}</span>
                      <SelectedCheck selected={issue.cycle == null} />
                    </ContextMenuItem>
                    {project.plannedCycles.map((cycle) => (
                      <ContextMenuItem key={cycle.id} onSelect={() => patch({ cycleId: cycle.id })}>
                        {colorDot(CYCLE_STATUS_META[cycle.status].color)}
                        <span className="flex-1 truncate">{cycle.name}</span>
                        <SelectedCheck selected={cycle.id === issue.cycle?.id} />
                      </ContextMenuItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
              )}

              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <CalendarClock />
                  {t('dueDate')}
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-72">
                  {dueDatePresets().map((p) => (
                    <ContextMenuItem
                      key={p.key}
                      onSelect={() => patch({ dueDate: toDateStr(p.date) })}
                    >
                      <CalendarClock />
                      <span className="whitespace-nowrap">{presetLabel(p.key)}</span>
                      <ContextMenuShortcut className="whitespace-nowrap">
                        {format.dateTime(p.date, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </ContextMenuShortcut>
                    </ContextMenuItem>
                  ))}
                  {issue.dueDate && (
                    <>
                      <ContextMenuSeparator />
                      <ContextMenuItem onSelect={() => patch({ dueDate: null })}>
                        <X />
                        {t('clearDueDate')}
                      </ContextMenuItem>
                    </>
                  )}
                </ContextMenuSubContent>
              </ContextMenuSub>

              {project.labels.length > 0 && (
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    <Tag />
                    {t('labels')}
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
            {t('copyPrompt')}
          </ContextMenuItem>

          {canEdit && <ContextMenuSeparator />}

          {/* Archiving hides the issue from the board but keeps it; restore brings it back. */}
          {canEdit &&
            (issue.archivedAt ? (
              <ContextMenuItem onSelect={() => restoreIssue.mutate(issue.id)}>
                <ArchiveRestore />
                {t('restore')}
              </ContextMenuItem>
            ) : (
              <ContextMenuItem onSelect={() => archive(issue)}>
                <Archive />
                {t('archive')}
              </ContextMenuItem>
            ))}

          {canDelete && <ContextMenuSeparator />}

          {canDelete && (
            <ContextMenuItem variant="destructive" onSelect={() => setConfirmingDelete(true)}>
              <Trash2 />
              {tCommon('delete')}
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

      {archiveDialog}
    </>
  );
}
