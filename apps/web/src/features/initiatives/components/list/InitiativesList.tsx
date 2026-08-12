import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Initiative, InitiativeSort, ProjectDetail } from '@/lib/api';
import type { InitiativesTab } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/common/page/EmptyState';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import InitiativeRow from './InitiativeRow';

// Columns in table order. A `sort` key marks the column as sortable; progress and
// health are derived per row and cannot be sorted server-side.
type ColumnKey = 'name' | 'priority' | 'owner' | 'target' | 'progress' | 'health';

const COLUMNS: { key: ColumnKey; sort?: InitiativeSort }[] = [
  { key: 'name', sort: 'title' },
  { key: 'priority', sort: 'priority' },
  { key: 'owner', sort: 'owner' },
  { key: 'target', sort: 'targetDate' },
  { key: 'progress' },
  { key: 'health' },
];

export default function InitiativesList({
  initiatives,
  project,
  isLoading,
  canCreate,
  onCreate,
  statusTab,
  sort,
  dir,
  onSort,
}: {
  initiatives: Initiative[];
  project: ProjectDetail;
  isLoading: boolean;
  canCreate: boolean;
  onCreate: () => void;
  // The open status tab, absent on the tab that lists every status. An empty
  // status tab is a filtered view, not a first run, so it says so.
  statusTab: Exclude<InitiativesTab, 'all'> | undefined;
  sort: InitiativeSort | undefined;
  dir: 'asc' | 'desc' | undefined;
  onSort: (key: InitiativeSort) => void;
}) {
  const t = useTranslations('initiatives');
  const ownerById = new Map(project.assignees.map((a) => [a.userId, a]));

  if (isLoading) return <ListSkeleton className="px-4 py-6" rowClassName="h-12" />;

  if (initiatives.length === 0) {
    if (statusTab)
      return (
        <EmptyState title={t(`emptyTab.${statusTab}`)} description={t('emptyTabDescription')} />
      );
    return (
      <EmptyState title={t('emptyTitle')} description={t('emptyDescription')}>
        {canCreate && (
          <Button size="sm" onClick={onCreate}>
            <Plus className="size-3.5" />
            {t('newInitiative')}
          </Button>
        )}
      </EmptyState>
    );
  }

  return (
    <div className="min-w-0 px-4 pb-2">
      <Table className="min-w-[880px] table-fixed">
        <colgroup>
          <col className="w-[34%]" />
          <col className="w-[10%]" />
          <col className="w-[22%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[10%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {COLUMNS.map((col) => (
              <TableHead key={col.key} className="px-3 text-xs font-medium text-muted-foreground">
                {col.sort ? (
                  <button
                    type="button"
                    onClick={() => onSort(col.sort!)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {t(`columns.${col.key}`)}
                    {sort === col.sort &&
                      (dir === 'desc' ? (
                        <ChevronDown className="size-3.5" />
                      ) : (
                        <ChevronUp className="size-3.5" />
                      ))}
                  </button>
                ) : (
                  t(`columns.${col.key}`)
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {initiatives.map((it) => (
            <InitiativeRow
              key={it.id}
              initiative={it}
              projectKey={project.project.key}
              owner={it.ownerUserId ? (ownerById.get(it.ownerUserId) ?? null) : null}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
