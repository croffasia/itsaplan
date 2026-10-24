import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue, IssuePatch } from '@/lib/api/endpoints/issues';
import { type Maps } from '@/utils/project';
import { useSetFieldValue, useUpdateIssue } from '@/services/issues.service';
import { columnKey } from '../../utils/table';
import { type TimelineColumn } from '../../utils/timeline';
import { TimelineBuiltinCell } from './TimelineBuiltinCell';
import { TimelineCustomCell } from './TimelineCustomCell';

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
        <TimelineBuiltinCell
          column={column.col}
          issue={issue}
          project={project}
          maps={maps}
          readOnly={readOnly}
          onPatch={patch}
        />
      ) : (
        <TimelineCustomCell
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
