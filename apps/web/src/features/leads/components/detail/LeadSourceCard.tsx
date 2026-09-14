import { ExternalLink } from 'lucide-react';
import type { LeadDetail } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatLeadDate } from '../../utils/leads';

export default function LeadSourceCard({ lead }: { lead: LeadDetail }) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Source and history</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Source</div>
            <div className="font-medium">{lead.source.type ?? '—'}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Collected</div>
            <div className="font-medium">{formatLeadDate(lead.source.collectedAt)}</div>
          </div>
        </div>
        {lead.evidence.length > 0 && (
          <div>
            <div className="font-medium">Public evidence</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {lead.evidence.map((item) => (
                <a
                  key={`${item.type}-${item.url}`}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="size-3" />
                  {item.type}
                </a>
              ))}
            </div>
          </div>
        )}
        <div>
          <div className="font-medium">Campaign history</div>
          <div className="mt-2 divide-y rounded-md border">
            {lead.campaignHistory.map((item) => (
              <div key={item.leadId} className="flex items-center justify-between gap-4 px-3 py-2">
                <span>{item.campaignName}</span>
                <span className="text-xs text-muted-foreground">
                  {formatLeadDate(item.lastSeenAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
