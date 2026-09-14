import type { LeadDetail } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import LeadsStatusBadge from '../LeadsStatusBadge';

export default function LeadWebsiteAuditCard({ lead }: { lead: LeadDetail }) {
  const audit = lead.audit;
  return (
    <Card className="shadow-none">
      <CardHeader className="flex grid-cols-none flex-row items-center justify-between">
        <CardTitle>Website audit</CardTitle>
        <LeadsStatusBadge status={audit?.status ?? lead.websiteStatus} />
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!audit ? (
          <p className="text-muted-foreground">No website audit is available.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <div className="text-xs text-muted-foreground">HTTP</div>
                <div className="font-medium">{audit.httpStatus ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Response</div>
                <div className="font-medium">
                  {audit.responseMs == null ? '—' : `${audit.responseMs} ms`}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Forms</div>
                <div className="font-medium">{audit.formCount ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Missing alt</div>
                <div className="font-medium">{audit.imagesMissingAlt ?? '—'}</div>
              </div>
            </div>
            {[...audit.desktopFindings, ...audit.mobileFindings, ...audit.technicalFindings]
              .length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {[
                  ...audit.desktopFindings,
                  ...audit.mobileFindings,
                  ...audit.technicalFindings,
                ].map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
