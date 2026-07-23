import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Initiative, InitiativeSort, ProjectDetail } from '@/lib/api';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import InitiativeRow from './InitiativeRow';
import InitiativesEmpty from './InitiativesEmpty';

// Columns in table order. A `sort` key marks the column as sortable; progress and
// health are derived per row and cannot be sorted server-side.
const COLUMNS: { label: string; sort?: InitiativeSort }[] = [
  { label: 'Name', sort: 'title' },
  { label: 'Priority', sort: 'priority' },
  { label: 'Owner', sort: 'owner' },
  { label: 'Target', sort: 'targetDate' },
  { label: 'Progress' },
  { label: 'Health' },
];

export default function InitiativesList({
  initiatives,
  project,
  isLoading,
  canCreate,
  onCreate,
  sort,
  dir,
  onSort,
}: {
  initiatives: Initiative[];
  project: ProjectDetail;
  isLoading: boolean;
  canCreate: boolean;
  onCreate: () => void;
  sort: InitiativeSort | undefined;
  dir: 'asc' | 'desc' | undefined;
  onSort: (key: InitiativeSort) => void;
}) {
  const ownerById = new Map(project.assignees.map((a) => [a.userId, a]));

  if (isLoading) return <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>;
  if (initiatives.length === 0)
    return <InitiativesEmpty canCreate={canCreate} onCreate={onCreate} />;

  return (
    <div className="px-4 pb-2">
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
              <TableHead key={col.label} className="px-3 text-xs font-medium text-muted-foreground">
                {col.sort ? (
                  <button
                    type="button"
                    onClick={() => onSort(col.sort!)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {col.label}
                    {sort === col.sort &&
                      (dir === 'desc' ? (
                        <ChevronDown className="size-3.5" />
                      ) : (
                        <ChevronUp className="size-3.5" />
                      ))}
                  </button>
                ) : (
                  col.label
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
