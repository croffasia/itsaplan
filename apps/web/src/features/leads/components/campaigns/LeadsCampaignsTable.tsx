import type { LeadCampaign } from '@/lib/api';
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

export default function LeadsCampaignsTable({ campaigns }: { campaigns: LeadCampaign[] }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table className="min-w-[980px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Campaign</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Results</TableHead>
            <TableHead>Valid leads</TableHead>
            <TableHead>Analysis</TableHead>
            <TableHead>Sourcing</TableHead>
            <TableHead>Export</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => (
            <TableRow key={campaign.id}>
              <TableCell>
                <div className="font-medium">{campaign.name}</div>
                <div className="text-xs text-muted-foreground">
                  {[campaign.niche, campaign.location].filter(Boolean).join(' · ') ||
                    campaign.source}
                </div>
              </TableCell>
              <TableCell className="tabular-nums">{campaign.targetLeads ?? '—'}</TableCell>
              <TableCell className="tabular-nums">{campaign.foundResults}</TableCell>
              <TableCell className="tabular-nums">{campaign.validLeads}</TableCell>
              <TableCell className="tabular-nums">
                {campaign.completedAnalyses}/{campaign.validLeads}
              </TableCell>
              <TableCell>
                <LeadsStatusBadge status={campaign.sourcingStatus ?? campaign.status} />
              </TableCell>
              <TableCell>
                <LeadsStatusBadge status={campaign.exportStatus} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatLeadDate(campaign.updatedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
