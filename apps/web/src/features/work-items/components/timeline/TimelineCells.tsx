import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue, IssuePatch } from '@/lib/api/endpoints/issues';
import { type Maps } from '@/utils/project';
import { useSetFieldValue, useUpdateIssue } from '@/services/issues.service';
import { columnKey, type TableColumn } from '../../utils/table';
import { type TimelineColumn } from '../../utils/timeline';
import { EditableBuiltinCell } from '../shared/EditableBuiltinCell';
import { EditableCustomCell } from '../shared/EditableCustomCell';
import { PersonValue } from '../shared/PersonValue';
import { TableBuiltinCell } from '../table/TableBuiltinCell';

// The property cells of one timeline row, after its title. They sit outside the
// title, which drags the row and opens the issue, so an edit in a cell does neither.
export function TimelineCells({
  project,
  issue,
  maps,
  columns,
  readOnly,
}: {
  project: ProjectDetail;
  issue: Issue;
  maps: Maps;
  columns: TimelineColumn[];
  readOnly: boolean;
}) {
  const updateIssue = useUpdateIssue(project.project.ref);
  const setFieldValue = useSetFieldValue(project.project.ref);
  const patch = (fields: IssuePatch) => updateIssue.mutate({ id: issue.id, patch: fields });

  return columns.map(({ column, width }) => (
    <div
      key={columnKey(column)}
      className="grid shrink-0 items-center overflow-hidden px-1.5"
      style={{ width }}
    >
      {column.kind === 'builtin' ? (
        <EditableBuiltinCell
          column={column.col}
          issue={issue}
          project={project}
          readOnly={readOnly}
          onPatch={patch}
        >
          <BuiltinValue column={column.col} issue={issue} maps={maps} />
        </EditableBuiltinCell>
      ) : (
        <EditableCustomCell
          field={column.field}
          issue={issue}
          project={project}
          maps={maps}
          readOnly={readOnly}
          onChange={(value) =>
            setFieldValue.mutate({ issueId: issue.id, fieldId: column.field.id, value })
          }
        />
      )}
    </div>
  ));
}

// A built-in value as the Table shows it, except that the assignee and the
// delegate are named.
function BuiltinValue({ column, issue, maps }: { column: TableColumn; issue: Issue; maps: Maps }) {
  if (column !== 'assignee' && column !== 'delegate') {
    return <TableBuiltinCell column={column} issue={issue} maps={maps} />;
  }
  const personId = column === 'assignee' ? issue.assigneeUserId : issue.delegateUserId;
  return <PersonValue person={personId != null ? maps.assigneeById.get(personId) : undefined} />;
}
