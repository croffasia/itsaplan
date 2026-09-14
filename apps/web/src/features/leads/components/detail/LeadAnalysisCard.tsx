import type { LeadDetail } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatScore } from '../../utils/leads';

export default function LeadAnalysisCard({ lead }: { lead: LeadDetail }) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Lead analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Qualification</div>
            <div className="text-2xl font-semibold tabular-nums">
              {formatScore(lead.qualificationScore)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Opportunity</div>
            <div className="text-2xl font-semibold tabular-nums">
              {formatScore(lead.digitalOpportunityScore)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Website</div>
            <div className="text-2xl font-semibold tabular-nums">
              {formatScore(lead.websiteQualityScore)}
            </div>
          </div>
        </div>
        <div>
          <div className="text-sm font-medium">Recommendation</div>
          <p className="mt-1 text-sm text-muted-foreground">
            {lead.recommendation ?? 'No recommendation available.'}
          </p>
        </div>
        {lead.recommendedService && (
          <div>
            <div className="text-sm font-medium">Recommended service</div>
            <p className="mt-1 text-sm text-muted-foreground">{lead.recommendedService}</p>
          </div>
        )}
        {lead.opportunities.length > 0 && (
          <div>
            <div className="text-sm font-medium">Opportunities</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {lead.opportunities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {lead.findings.length > 0 && (
          <div>
            <div className="text-sm font-medium">Findings</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {lead.findings.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
