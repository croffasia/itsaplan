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
import { useIssueQuery, useRestoreIssue, useUpdateIssue } from '@/services/issues.service';
import { usePermissions } from '@/hooks/usePermissions';
import { useSession } from '@/lib/auth-client';
import { useShell } from '@/context/shellContext';
import { colorDot } from '@/components/common/fields/colorDot';
import { useFormatter, useTranslations } from 'next-intl';
import { PRIORITY_FIELDS } from '@/components/common/fields/priorityFields';
import { usePriorityLabel } from '@/hooks/usePriorityLabel';
import type { Command, CommandSection } from '@/utils/commands';
import {
  ApplyActionDialog,
  DeleteIssueDialog,
  matchedActions,
} from '../components/actions/IssueActions';
import { useArchiveAction } from './useArchiveAction';
import { StateIcon } from '../components/shared/IssueIcons';
import { dueDatePresets } from '../utils/dueDatePresets';
import { useDueDatePresetLabel } from './useDueDatePresetLabel';
import { buildIssuePrompt } from '../utils/issuePrompt';
import { delegatableAgents } from '../utils/delegates';

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
  const t = useTranslations('issue.commands');
  const tPriority = useTranslations('common.priority');
  const format = useFormatter();
  const priorityLabel = usePriorityLabel();
  const presetLabel = useDueDatePresetLabel();
  const { onOpenIssue } = useShell();
  const { data: session } = useSession();
  const projectKey = project?.project.key ?? null;
  const issueQuery = useIssueQuery(issueId);
  const issue = issueQuery.data ?? null;
  const updateIssue = useUpdateIssue(projectKey);
  const { archive, dialog: archiveDialog } = useArchiveAction(project, onDeleted);
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
        {archiveDialog}
      </>
    ) : null;

  if (!project || !issue) return { section: null, dialogs };

  const canEdit = can('work_items', 'edit');
  const canDelete = can('work_items', 'delete');
  const patch = (fields: IssuePatch) => updateIssue.mutate({ id: issue.id, patch: fields });
  const members = project.assignees.filter((a) => a.kind === 'member');
  const agents = delegatableAgents(project.assignees, session?.user.id ?? null);
  const actions = matchedActions(actionsQuery.data ?? [], project, issue);
  const currentColumn = project.columns.find((c) => c.id === issue.columnId);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(buildIssuePrompt(issue, project, session?.user));
    toast.success(t('promptCopied'));
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/${issue.identifier}`);
    toast.success(t('shortLinkCopied'));
  };

  const items: Command[] = [
    {
      id: 'issue.preview',
      label: t('preview'),
      icon: <PanelRight />,
      keywords: 'open panel side',
      run: () => onOpenIssue(issue.id, 'panel'),
    },
    {
      id: 'issue.open',
      label: t('goToIssue'),
      icon: <SquareArrowOutUpRight />,
      keywords: 'open page full',
      run: () => onOpenIssue(issue.id, 'page'),
    },
  ];

  if (canEdit) {
    items.push({
      id: 'issue.status',
      label: t('status'),
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
        heading: t('status'),
        placeholder: t('statusPlaceholder'),
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
      label: t('priority'),
      icon: (PRIORITY_FIELDS.find((p) => p.value === (issue.priority ?? '')) ?? PRIORITY_FIELDS[0])
        .icon,
      keywords: 'urgent high medium low',
      submenu: {
        heading: t('priority'),
        placeholder: tPriority('setTo'),
        items: PRIORITY_FIELDS.map((p) => ({
          id: `issue.priority.${p.value || 'none'}`,
          label: priorityLabel(p.value),
          icon: p.icon,
          checked: p.value === (issue.priority ?? ''),
          run: () => patch({ priority: p.value || null }),
        })),
      },
    });

    if (members.length > 0) {
      items.push({
        id: 'issue.assignee',
        label: t('assignee'),
        icon: <User />,
        keywords: 'owner member',
        submenu: {
          heading: t('assignee'),
          placeholder: t('assigneePlaceholder'),
          items: [
            {
              id: 'issue.assignee.none',
              label: t('noAssignee'),
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
        label: t('delegate'),
        icon: <Bot />,
        keywords: 'ai bot',
        submenu: {
          heading: t('delegate'),
          placeholder: t('delegatePlaceholder'),
          items: [
            {
              id: 'issue.delegate.none',
              label: t('noDelegate'),
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
      label: t('dueDate'),
      icon: <CalendarClock />,
      keywords: 'deadline schedule',
      submenu: {
        heading: t('dueDate'),
        placeholder: t('dueDatePlaceholder'),
        items: [
          ...dueDatePresets().map((p) => ({
            id: `issue.due-date.${p.key}`,
            label: presetLabel(p.key),
            icon: <CalendarClock />,
            shortcut: format.dateTime(p.date, { weekday: 'short', month: 'short', day: 'numeric' }),
            run: () => patch({ dueDate: toDateStr(p.date) }),
          })),
          ...(issue.dueDate
            ? [
                {
                  id: 'issue.due-date.clear',
                  label: t('clearDueDate'),
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
        label: t('labels'),
        icon: <Tag />,
        keywords: 'tag',
        submenu: {
          heading: t('labels'),
          placeholder: t('labelsPlaceholder'),
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
      label: t('copyShortLink'),
      icon: <Share2 />,
      keywords: 'url share',
      run: () => void copyLink(),
    },
    {
      id: 'issue.copy-prompt',
      label: t('copyPrompt'),
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
            label: t('restore'),
            icon: <ArchiveRestore />,
            run: () => restoreIssue.mutate(issue.id),
          }
        : {
            id: 'issue.archive',
            label: t('archive'),
            icon: <Archive />,
            run: () => archive(issue),
          },
    );
  }

  if (canDelete) {
    items.push({
      id: 'issue.delete',
      label: t('delete'),
      icon: <Trash2 />,
      destructive: true,
      run: () => setConfirmingDelete(true),
    });
  }

  return { section: { id: 'issue', heading: issue.identifier, items }, dialogs };
}
