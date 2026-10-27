import type { ReactNode } from 'react';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue, IssuePatch } from '@/lib/api/endpoints/issues';
import { parseDate } from '@/utils/dates';
import AssigneeSelect from '@/components/common/fields/AssigneeSelect';
import DatePill from '@/components/common/fields/DatePill';
import LabelsSelect from '@/components/common/fields/LabelsSelect';
import PrioritySelect from '@/components/common/fields/PrioritySelect';
import StatusSelect from '@/components/common/fields/StatusSelect';
import TypeSelect from '@/components/common/fields/TypeSelect';
import CycleSelect from '@/features/issue/components/fields/CycleSelect';
import DelegateSelect from '@/features/issue/components/fields/DelegateSelect';
import InitiativeSelect from '@/features/issue/components/fields/InitiativeSelect';
import { type TableColumn } from '../../utils/table';
import { CellButton } from './CellButton';
import { CellEditor } from './CellEditor';

// One built-in property cell showing `children` as its value. When the issue can be
// edited, a click opens the picker the issue panel uses for that field. The
// estimates and the times are shown only.
export function EditableBuiltinCell({
  column,
  issue,
  project,
  readOnly,
  onPatch,
  children,
}: {
  column: TableColumn;
  issue: Issue;
  project: ProjectDetail;
  readOnly: boolean;
  onPatch: (patch: IssuePatch) => void;
  children: ReactNode;
}) {
  const editor = readOnly
    ? null
    : builtinEditor(column, issue, project, onPatch, <CellButton>{children}</CellButton>);
  return editor ? <CellEditor>{editor}</CellEditor> : children;
}

function builtinEditor(
  column: TableColumn,
  issue: Issue,
  project: ProjectDetail,
  onPatch: (patch: IssuePatch) => void,
  trigger: ReactNode,
): ReactNode {
  switch (column) {
    case 'status':
      return (
        <StatusSelect
          columns={project.columns}
          value={issue.columnId}
          onChange={(id) => onPatch({ columnId: id })}
          trigger={trigger}
        />
      );
    case 'priority':
      return (
        <PrioritySelect
          value={issue.priority ?? ''}
          onChange={(v) => onPatch({ priority: v || null })}
          trigger={trigger}
        />
      );
    case 'type':
      return (
        <TypeSelect
          issueTypes={project.issueTypes}
          value={issue.typeId}
          onChange={(id) => onPatch({ typeId: id })}
          trigger={trigger}
        />
      );
    case 'assignee':
      return (
        <AssigneeSelect
          assignees={project.assignees}
          value={issue.assigneeUserId}
          onChange={(userId) => onPatch({ assigneeUserId: userId })}
          trigger={trigger}
        />
      );
    case 'delegate':
      return (
        <DelegateSelect
          assignees={project.assignees}
          value={issue.delegateUserId}
          onChange={(userId) => onPatch({ delegateUserId: userId })}
          trigger={trigger}
        />
      );
    case 'labels':
      return (
        <LabelsSelect
          labels={project.labels}
          groups={project.labelGroups}
          value={issue.labelIds}
          onToggle={(id) =>
            onPatch({
              labelIds: issue.labelIds.includes(id)
                ? issue.labelIds.filter((x) => x !== id)
                : [...issue.labelIds, id],
            })
          }
          trigger={trigger}
        />
      );
    case 'initiative':
      return (
        <InitiativeSelect
          projectKey={project.project.ref}
          value={issue.initiative?.id ?? null}
          onChange={(id) => onPatch({ initiativeId: id })}
          trigger={trigger}
        />
      );
    case 'cycle':
      return (
        <CycleSelect
          projectKey={project.project.ref}
          value={issue.cycle}
          onChange={(cycle) => onPatch({ cycleId: cycle?.id ?? null })}
          trigger={trigger}
        />
      );
    case 'startDate': {
      const latestStart = parseDate(issue.dueDate);
      return (
        <DatePill
          value={issue.startDate}
          onChange={(v) => onPatch({ startDate: v })}
          disabled={latestStart ? { after: latestStart } : undefined}
          trigger={trigger}
        />
      );
    }
    case 'dueDate': {
      const earliestDue = parseDate(issue.startDate);
      return (
        <DatePill
          value={issue.dueDate}
          onChange={(v) => onPatch({ dueDate: v })}
          disabled={earliestDue ? { before: earliestDue } : undefined}
          trigger={trigger}
        />
      );
    }
    default:
      return null;
  }
}
