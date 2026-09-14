import { ExternalLink, Mail, MapPin, Phone } from 'lucide-react';
import type { LeadDetail } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LeadOverviewCard({ lead }: { lead: LeadDetail }) {
  const location = [lead.address, lead.postalCode, lead.city, lead.countryCode]
    .filter(Boolean)
    .join(', ');
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Company</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <div className="text-muted-foreground">Category</div>
          <div className="font-medium">{lead.category ?? '—'}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Campaign</div>
          <div className="font-medium">{lead.campaignName}</div>
        </div>
        <div className="flex gap-2">
          <MapPin className="mt-0.5 size-4 text-muted-foreground" />
          <span>{location || 'No address available'}</span>
        </div>
        <div className="flex gap-2">
          <Phone className="mt-0.5 size-4 text-muted-foreground" />
          <span>{lead.phone ?? 'No phone available'}</span>
        </div>
        <div className="flex gap-2">
          <Mail className="mt-0.5 size-4 text-muted-foreground" />
          <span>{lead.publicBusinessEmail ?? 'No public business email'}</span>
        </div>
        <div className="flex gap-2">
          <ExternalLink className="mt-0.5 size-4 text-muted-foreground" />
          {lead.website ? (
            <a
              className="truncate underline underline-offset-4"
              href={lead.website}
              target="_blank"
              rel="noreferrer"
            >
              {lead.website}
            </a>
          ) : (
            <span>No first-party website</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
