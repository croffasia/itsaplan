import type { LeadAgentRun } from '@/lib/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import LeadsStatusBadge from '../LeadsStatusBadge';
import { formatLeadDate } from '../../utils/leads';

export default function LeadsAgentRunsTable({ runs }: { runs: LeadAgentRun[] }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table className="min-w-[980px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Campaign</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Analysis</TableHead>
            <TableHead>Retry</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.id}>
              <TableCell className="font-medium">{run.campaignName}</TableCell>
              <TableCell>
                <div>Google Maps sourcing</div>
                <div className="text-xs text-muted-foreground">{run.provider}</div>
              </TableCell>
              <TableCell>
                <LeadsStatusBadge status={run.status} />
              </TableCell>
              <TableCell className="tabular-nums">
                {run.processed}/{run.requested || '—'}
              </TableCell>
              <TableCell className="tabular-nums">
                {run.succeeded} completed{run.failed > 0 ? ` · ${run.failed} failed` : ''}
              </TableCell>
              <TableCell>
                <LeadsStatusBadge status={run.retryStatus} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatLeadDate(run.updatedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
