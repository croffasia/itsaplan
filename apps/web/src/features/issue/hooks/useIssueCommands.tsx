import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  Archive,
  ArchiveRestore,
  Bot,
  CalendarClock,
  CircleDashed,
  ClipboardCopy,
  PanelRight,
  Share2,
  SquareArrowOutUpRight,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { ActionDef, IssuePatch, ProjectDetail } from '@/lib/api';
import { actionIcon } from '@/utils/actionIcons';
import { toDateStr } from '@/utils/dates';
import { useActionsQuery } from '@/services/actions.service';
import {
  useArchiveIssue,
  useIssueQuery,
  useRestoreIssue,
  useUpdateIssue,
} from '@/services/issues.service';
import { usePermissions } from '@/hooks/usePermissions';
import { useSession } from '@/lib/auth-client';
import { useShell } from '@/context/shellContext';
import { colorDot } from '@/components/common/fields/colorDot';
import { PRIORITY_FIELDS } from '@/components/common/fields/priorityFields';
import type { Command, CommandSection } from '@/utils/commands';
import {
  ApplyActionDialog,
  DeleteIssueDialog,
  matchedActions,
} from '../components/actions/IssueActions';
import { StateIcon } from '../components/shared/IssueIcons';
import { dueDatePresets, formatPreset } from '../utils/dueDatePresets';
import { buildIssuePrompt } from '../utils/issuePrompt';

// The palette commands for the issue the user is looking at — the issue page or
// the open detail panel. They are the context menu's actions in command form and
// run the same mutations, so both surfaces stay in step. The confirm dialogs are
// returned separately: the palette closes when a command runs, so they must be
// rendered by the host that outlives it.
export function useIssueCommands(
  project: ProjectDetail | null,
  issueId: number | null,
  onDeleted?: () => void,
): { section: CommandSection | null; dialogs: ReactNode } {
  const { can } = usePermissions();
  const { onOpenIssue } = useShell();
  const { data: session } = useSession();
  const projectKey = project?.project.key ?? null;
  const issueQuery = useIssueQuery(issueId);
  const issue = issueQuery.data ?? null;
  const updateIssue = useUpdateIssue(projectKey);
  const archiveIssue = useArchiveIssue(projectKey);
  const restoreIssue = useRestoreIssue(projectKey);
  const actionsQuery = useActionsQuery(projectKey);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingAction, setConfirmingAction] = useState<ActionDef | null>(null);

  const dialogs =
    project && issue ? (
      <>
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
    ) : null;

  if (!project || !issue) return { section: null, dialogs };

  const canEdit = can('work_items', 'edit');
  const canDelete = can('work_items', 'delete');
  const patch = (fields: IssuePatch) => updateIssue.mutate({ id: issue.id, patch: fields });
  const members = project.assignees.filter((a) => a.kind === 'member');
  const agents = project.assignees.filter((a) => a.kind === 'agent');
  const actions = matchedActions(actionsQuery.data ?? [], project, issue);
  const currentColumn = project.columns.find((c) => c.id === issue.columnId);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(buildIssuePrompt(issue, project, session?.user));
    toast.success('Prompt copied to clipboard');
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/${issue.identifier}`);
    toast.success('Short link copied');
  };

  const items: Command[] = [
    {
      id: 'issue.preview',
      label: 'Preview issue',
      icon: <PanelRight />,
      keywords: 'open panel side',
      run: () => onOpenIssue(issue.id, 'panel'),
    },
    {
      id: 'issue.open',
      label: 'Go to issue',
      icon: <SquareArrowOutUpRight />,
      keywords: 'open page full',
      run: () => onOpenIssue(issue.id, 'page'),
    },
  ];

  if (canEdit) {
    items.push({
      id: 'issue.status',
      label: 'Change status',
      icon: currentColumn ? (
        <StateIcon
          stateType={currentColumn.stateType}
          color={currentColumn.color}
          className="size-3.5"
        />
      ) : (
        <CircleDashed />
      ),
      keywords: 'state column move',
      submenu: {
        heading: 'Change status',
        placeholder: 'Set status to…',
        items: project.columns.map((c) => ({
          id: `issue.status.${c.id}`,
          label: c.name,
          icon: <StateIcon stateType={c.stateType} color={c.color} className="size-3.5" />,
          checked: c.id === issue.columnId,
          run: () => patch({ columnId: c.id }),
        })),
      },
    });

    items.push({
      id: 'issue.priority',
      label: 'Set priority',
      icon: (PRIORITY_FIELDS.find((p) => p.value === (issue.priority ?? '')) ?? PRIORITY_FIELDS[0])
        .icon,
      keywords: 'urgent high medium low',
      submenu: {
        heading: 'Set priority',
        placeholder: 'Set priority to…',
        items: PRIORITY_FIELDS.map((p) => ({
          id: `issue.priority.${p.value || 'none'}`,
          label: p.label,
          icon: p.icon,
          checked: p.value === (issue.priority ?? ''),
          run: () => patch({ priority: p.value || null }),
        })),
      },
    });

    if (members.length > 0) {
      items.push({
        id: 'issue.assignee',
        label: 'Assign to',
        icon: <User />,
        keywords: 'owner member',
        submenu: {
          heading: 'Assign to',
          placeholder: 'Assign to…',
          items: [
            {
              id: 'issue.assignee.none',
              label: 'No assignee',
              icon: <CircleDashed />,
              checked: issue.assigneeUserId == null,
              run: () => patch({ assigneeUserId: null }),
            },
            ...members.map((a) => ({
              id: `issue.assignee.${a.userId}`,
              label: a.name,
              icon: <User />,
              checked: a.userId === issue.assigneeUserId,
              run: () => patch({ assigneeUserId: a.userId }),
            })),
          ],
        },
      });
    }

    if (agents.length > 0) {
      items.push({
        id: 'issue.delegate',
        label: 'Delegate to agent',
        icon: <Bot />,
        keywords: 'ai bot',
        submenu: {
          heading: 'Delegate to agent',
          placeholder: 'Delegate to…',
          items: [
            {
              id: 'issue.delegate.none',
              label: 'No delegate',
              icon: <CircleDashed />,
              checked: issue.delegateUserId == null,
              run: () => patch({ delegateUserId: null }),
            },
            ...agents.map((a) => ({
              id: `issue.delegate.${a.userId}`,
              label: a.name,
              icon: <Bot />,
              checked: a.userId === issue.delegateUserId,
              run: () => patch({ delegateUserId: a.userId }),
            })),
          ],
        },
      });
    }

    items.push({
      id: 'issue.due-date',
      label: 'Set due date',
      icon: <CalendarClock />,
      keywords: 'deadline schedule',
      submenu: {
        heading: 'Set due date',
        placeholder: 'Set due date to…',
        items: [
          ...dueDatePresets().map((p) => ({
            id: `issue.due-date.${p.key}`,
            label: p.label,
            icon: <CalendarClock />,
            shortcut: formatPreset(p.date),
            run: () => patch({ dueDate: toDateStr(p.date) }),
          })),
          ...(issue.dueDate
            ? [
                {
                  id: 'issue.due-date.clear',
                  label: 'Clear due date',
                  icon: <X />,
                  run: () => patch({ dueDate: null }),
                },
              ]
            : []),
        ],
      },
    });

    if (project.labels.length > 0) {
      items.push({
        id: 'issue.labels',
        label: 'Toggle labels',
        icon: <Tag />,
        keywords: 'tag',
        submenu: {
          heading: 'Toggle labels',
          placeholder: 'Toggle a label…',
          items: project.labels.map((l) => ({
            id: `issue.labels.${l.id}`,
            label: l.name,
            icon: colorDot(l.color),
            checked: issue.labelIds.includes(l.id),
            // Stay open so several labels can be toggled in one pass.
            keepOpen: true,
            run: () =>
              patch({
                labelIds: issue.labelIds.includes(l.id)
                  ? issue.labelIds.filter((x) => x !== l.id)
                  : [...issue.labelIds, l.id],
              }),
          })),
        },
      });
    }

    for (const a of actions) {
      const Icon = actionIcon(a.icon);
      items.push({
        id: `issue.action.${a.id}`,
        label: a.name,
        icon: <Icon />,
        keywords: 'action apply',
        run: () => setConfirmingAction(a),
      });
    }
  }

  items.push(
    {
      id: 'issue.copy-link',
      label: 'Copy short link',
      icon: <Share2 />,
      keywords: 'url share',
      run: () => void copyLink(),
    },
    {
      id: 'issue.copy-prompt',
      label: 'Copy prompt',
      icon: <ClipboardCopy />,
      keywords: 'ai markdown clipboard',
      run: () => void copyPrompt(),
    },
  );

  if (canEdit) {
    items.push(
      issue.archivedAt
        ? {
            id: 'issue.restore',
            label: 'Restore issue',
            icon: <ArchiveRestore />,
            run: () => restoreIssue.mutate(issue.id),
          }
        : {
            id: 'issue.archive',
            label: 'Archive issue',
            icon: <Archive />,
            run: () => {
              archiveIssue.mutate(issue.id);
              onDeleted?.();
            },
          },
    );
  }

  if (canDelete) {
    items.push({
      id: 'issue.delete',
      label: 'Delete issue',
      icon: <Trash2 />,
      destructive: true,
      run: () => setConfirmingDelete(true),
    });
  }

  return { section: { id: 'issue', heading: issue.identifier, items }, dialogs };
}
