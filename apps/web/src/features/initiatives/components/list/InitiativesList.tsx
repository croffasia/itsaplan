import type { Initiative, ProjectDetail } from '@/lib/api';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import InitiativeRow from './InitiativeRow';
import InitiativesEmpty from './InitiativesEmpty';

export default function InitiativesList({
  initiatives,
  project,
  isLoading,
  canCreate,
  onCreate,
}: {
  initiatives: Initiative[];
  project: ProjectDetail;
  isLoading: boolean;
  canCreate: boolean;
  onCreate: () => void;
}) {
  const ownerById = new Map(project.assignees.map((a) => [a.userId, a]));

  if (isLoading) return <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>;
  if (initiatives.length === 0)
    return <InitiativesEmpty canCreate={canCreate} onCreate={onCreate} />;

  return (
    <div className="px-4 pb-6">
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
            <TableHead className="px-3 text-xs font-medium text-muted-foreground">Name</TableHead>
            <TableHead className="px-3 text-xs font-medium text-muted-foreground">
              Priority
            </TableHead>
            <TableHead className="px-3 text-xs font-medium text-muted-foreground">Owner</TableHead>
            <TableHead className="px-3 text-xs font-medium text-muted-foreground">Target</TableHead>
            <TableHead className="px-3 text-xs font-medium text-muted-foreground">
              Progress
            </TableHead>
            <TableHead className="px-3 text-xs font-medium text-muted-foreground">Health</TableHead>
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
