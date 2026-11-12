import { useTranslations } from 'next-intl';
import type { SubtaskMode, SubtreeIssue } from '@/lib/api/endpoints/issues';
import { useProjectQuery } from '@/services/projects.service';
import { issuePath } from '@/utils/paths';
import { removalRole, subtreeRows } from '@/utils/subtasks';
import { cn } from '@/lib/utils';
import { StateIcon } from '../shared/IssueIcons';

// The issues under the ones the action is about, indented by level. In a delete or an
// archive (`removal`) with a subtask choice made (`mode`), each is tagged with what
// happens to it. `newParent` is the identifier a reassign goes to.
export default function IssueSubtaskTree({
  projectKey,
  rootIds,
  issues,
  removal,
  mode = null,
  newParent = null,
}: {
  projectKey: string;
  rootIds: number[];
  issues: SubtreeIssue[];
  removal?: 'delete' | 'archive';
  mode?: SubtaskMode | null;
  newParent?: string | null;
}) {
  const t = useTranslations('issue.subtaskDisposal');
  const tc = useTranslations('common');
  const columns = useProjectQuery(projectKey).data?.columns ?? [];
  const columnById = new Map(columns.map((column) => [column.id, column]));
  const identifierOf = new Map(issues.map((issue) => [issue.id, issue.identifier]));

  const tag = (
    issue: SubtreeIssue,
    role: ReturnType<typeof removalRole>,
  ): { label: string; tone: string } | null => {
    if (role === 'removed')
      return removal === 'delete'
        ? { label: t('tagDeleted'), tone: 'bg-destructive/15' }
        : { label: t('tagArchived'), tone: 'bg-secondary' };
    if (role === 'nested') {
      const label =
        mode === 'reassign'
          ? t('tagMovesAlong')
          : t('tagStaysUnder', { issue: identifierOf.get(issue.parentId) ?? '' });
      return { label, tone: 'text-muted-foreground' };
    }
    if (mode === 'detach') return { label: t('tagNoParent'), tone: 'bg-secondary' };
    return newParent
      ? { label: t('tagMovesTo', { issue: newParent }), tone: 'bg-secondary' }
      : null;
  };

  return (
    <ul className="grid max-h-80 grid-cols-[minmax(0,1fr)_auto] gap-x-4 overflow-y-auto rounded-lg bg-background py-1.5 pe-3">
      {subtreeRows(issues, rootIds).map(({ issue, depth }) => {
        const column = columnById.get(issue.columnId);
        const role = removal && mode ? removalRole(issue, rootIds, mode) : null;
        const outcomeTag = role && tag(issue, role);
        const gone = role === 'removed' ? removal : null;
        return (
          <li
            key={issue.id}
            className="col-span-2 grid min-h-9 grid-cols-subgrid items-center text-sm"
          >
            <span
              className="flex min-w-0 items-center gap-2"
              style={{ paddingInlineStart: 12 + depth * 6 }}
            >
              {column && (
                <StateIcon stateType={column.stateType} color={column.color} className="shrink-0" />
              )}
              <a
                href={issuePath(projectKey, issue.sequenceNumber)}
                target="_blank"
                rel="noreferrer"
                dir="ltr"
                className="shrink-0 text-xs text-muted-foreground tabular-nums hover:text-foreground hover:underline"
              >
                {issue.identifier}
              </a>
              <span
                dir="auto"
                className={cn(
                  'min-w-0 flex-1 truncate',
                  gone === 'delete' && 'text-muted-foreground line-through',
                )}
              >
                {issue.title}
              </span>
              {issue.archived && gone !== 'archive' && (
                <span className="shrink-0 text-xs text-muted-foreground">{tc('archived')}</span>
              )}
            </span>
            {outcomeTag ? (
              <span
                className={cn(
                  'justify-self-start rounded-md px-2 text-xs leading-5 font-medium whitespace-nowrap',
                  outcomeTag.tone,
                )}
              >
                {outcomeTag.label}
              </span>
            ) : (
              <span />
            )}
          </li>
        );
      })}
    </ul>
  );
}
