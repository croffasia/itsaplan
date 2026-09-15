import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { StateIcon } from '@/features/issue/components/shared/IssueIcons';
import { PriorityBadge } from '@/features/issue/components/shared/IssueBadges';
import { groupKeyOf } from '@/utils/project';
import type { ColumnSearchResult as SearchResult } from '../../utils/columnSearch';
import { useColumnSearchContext } from '../../context/columnSearchContext';
import { ColumnSearchHighlight } from './ColumnSearchHighlight';

export function ColumnSearchResult({
  result,
  tabIndex,
  onFocus,
}: {
  result: SearchResult;
  tabIndex: number;
  onFocus: () => void;
}) {
  const t = useTranslations('workItems.search');
  const search = useColumnSearchContext();
  const { issue, excerpt } = result;
  const parent = issue.parentId == null ? null : search.parentById.get(issue.parentId);
  const column = search.maps.columnById.get(issue.columnId);
  const lane =
    search.settings.subgroup === 'none'
      ? null
      : search.laneNames.get(groupKeyOf(issue, search.settings.subgroup));
  const has = (key: string) => search.settings.properties.some((property) => property === key);
  const type = issue.typeId == null ? null : search.maps.typeById.get(issue.typeId);
  const assignee =
    issue.assigneeUserId == null ? null : search.maps.assigneeById.get(issue.assigneeUserId);

  return (
    <Link
      href={search.issueHref(issue)}
      prefetch={false}
      scroll={false}
      tabIndex={tabIndex}
      data-search-task={issue.id}
      onFocus={onFocus}
      onNavigate={(event) => {
        event.preventDefault();
        search.openIssue(issue.id);
      }}
      className="column-search-result block min-h-11 w-full touch-auto rounded-md p-3 text-start text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      <span className="mb-1 flex min-w-0 items-center justify-between gap-2">
        <bdi className="text-xs text-muted-foreground">
          <ColumnSearchHighlight text={result.identifier} ranges={result.identifierRanges} />
        </bdi>
        {has('priority') && issue.priority && <PriorityBadge priority={issue.priority} />}
      </span>
      <span className="flex items-start gap-2">
        {has('status') && column && (
          <StateIcon
            stateType={column.stateType}
            color={column.color}
            className="mt-1 size-3.5 shrink-0"
          />
        )}
        <span dir="auto" className="line-clamp-2 min-w-0 font-medium break-words">
          <ColumnSearchHighlight text={result.title} ranges={result.titleRanges} />
        </span>
      </span>
      {excerpt && (
        <span className="mt-2 block text-sm break-words text-muted-foreground">
          <span className="font-medium">
            {excerpt.source === 'description' ? t('description') : excerpt.fieldName}:{' '}
          </span>
          <span dir="auto">
            <ColumnSearchHighlight text={excerpt.text} ranges={excerpt.ranges} />
          </span>
        </span>
      )}
      {(parent || lane || (has('type') && type) || (has('assignee') && assignee)) && (
        <span className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {parent && <span>{t('subtaskOf', { identifier: parent.identifier })}</span>}
          {lane && <span dir="auto">{lane}</span>}
          {has('type') && type && <span dir="auto">{type.name}</span>}
          {has('assignee') && assignee && <span dir="auto">{assignee.name}</span>}
        </span>
      )}
    </Link>
  );
}
