import { useTranslations } from 'next-intl';
import type { SubtreeIssue } from '@/lib/api/endpoints/issues';
import { useProjectQuery } from '@/services/projects.service';
import { issuePath } from '@/utils/paths';
import { subtreeRows } from '@/utils/subtasks';
import { cn } from '@/lib/utils';
import { StateIcon } from '../shared/IssueIcons';

// What a delete, an archive or a move does to each issue under the ones it is about.
// 'detach' and 'move' act on the direct subtasks; the ones further down keep their
// parent. Null while nothing is chosen.
export type SubtreeOutcome = 'delete' | 'archive' | 'detach' | 'move' | null;

// The issues under the ones the action is about, indented by level, each tagged with
// what the chosen option does to it. `newParent` is the identifier a move goes to.
export default function IssueSubtaskTree({
  projectKey,
  rootIds,
  issues,
  outcome,
  newParent = null,
}: {
  projectKey: string;
  rootIds: number[];
  issues: SubtreeIssue[];
  outcome: SubtreeOutcome;
  newParent?: string | null;
}) {
  const t = useTranslations('issue.subtaskDisposal');
  const tc = useTranslations('common');
  const columns = useProjectQuery(projectKey).data?.columns ?? [];
  const columnById = new Map(columns.map((column) => [column.id, column]));
  const identifierOf = new Map(issues.map((issue) => [issue.id, issue.identifier]));

  const tag = (issue: SubtreeIssue, depth: number): { label: string; tone: string } | null => {
    if (outcome === 'delete') return { label: t('tagDeleted'), tone: 'bg-destructive/15' };
    if (outcome === 'archive') return { label: t('tagArchived'), tone: 'bg-secondary' };
    if (outcome === null) return null;
    if (depth > 0) {
      const label =
        outcome === 'move'
          ? t('tagMovesAlong')
          : t('tagStaysUnder', { issue: identifierOf.get(issue.parentId) ?? '' });
      return { label, tone: 'text-muted-foreground' };
    }
    if (outcome === 'detach') return { label: t('tagNoParent'), tone: 'bg-secondary' };
    return newParent
      ? { label: t('tagMovesTo', { issue: newParent }), tone: 'bg-secondary' }
      : null;
  };

  // The tags sit in a column of their own, as wide as the longest one, so they line
  // up whatever the depth and the title length.
  return (
    <ul className="grid max-h-80 grid-cols-[minmax(0,1fr)_auto] gap-x-4 overflow-y-auto rounded-lg bg-background py-1.5 pe-3">
      {subtreeRows(issues, rootIds).map(({ issue, depth }) => {
        const column = columnById.get(issue.columnId);
        const outcomeTag = tag(issue, depth);
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
                  outcome === 'delete' && 'text-muted-foreground line-through',
                )}
              >
                {issue.title}
              </span>
              {issue.archived && outcome !== 'archive' && (
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
