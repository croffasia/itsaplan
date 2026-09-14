import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { ApprovalLead } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { leadsLeadPath } from '@/utils/paths';
import LeadsStatusBadge from '../LeadsStatusBadge';

export default function LeadsApprovalTable({
  leads,
  projectKey,
}: {
  leads: ApprovalLead[];
  projectKey: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table className="min-w-[1060px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Company</TableHead>
            <TableHead>Campaign</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Qualification</TableHead>
            <TableHead>Opportunity</TableHead>
            <TableHead>Fit</TableHead>
            <TableHead>Review</TableHead>
            <TableHead aria-label="Open" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell>
                <Link
                  className="font-medium hover:underline"
                  href={leadsLeadPath(projectKey, lead.id)}
                >
                  {lead.companyName}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {lead.category ?? lead.websiteStatus}
                </div>
              </TableCell>
              <TableCell>{lead.campaignName}</TableCell>
              <TableCell>{[lead.postalCode, lead.city].filter(Boolean).join(' ') || '—'}</TableCell>
              <TableCell className="font-medium tabular-nums">{lead.qualificationScore}</TableCell>
              <TableCell className="tabular-nums">{lead.digitalOpportunityScore}</TableCell>
              <TableCell>{lead.businessFit}</TableCell>
              <TableCell>
                <LeadsStatusBadge status={lead.reviewStatus} />
              </TableCell>
              <TableCell>
                <Button asChild variant="ghost" size="icon-sm">
                  <Link
                    href={leadsLeadPath(projectKey, lead.id)}
                    aria-label={`Open ${lead.companyName}`}
                  >
                    <ExternalLink />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
