import { Activity, Building2, ClipboardCheck, SearchCheck } from 'lucide-react';
import type { LeadCampaign } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LeadsCampaignSummaryCards({ campaigns }: { campaigns: LeadCampaign[] }) {
  const cards = [
    { label: 'Campaigns', value: campaigns.length, icon: Building2 },
    {
      label: 'Valid leads',
      value: campaigns.reduce((total, campaign) => total + campaign.validLeads, 0),
      icon: SearchCheck,
    },
    {
      label: 'Analyses completed',
      value: campaigns.reduce((total, campaign) => total + campaign.completedAnalyses, 0),
      icon: ClipboardCheck,
    },
    {
      label: 'Runs needing attention',
      value: campaigns.filter((campaign) =>
        ['failed', 'reconciliation_required'].includes(campaign.sourcingStatus ?? ''),
      ).length,
      icon: Activity,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="gap-3 py-5 shadow-none">
          <CardHeader className="flex grid-cols-none flex-row items-center justify-between px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
            <card.icon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-5 text-2xl font-semibold tracking-tight tabular-nums">
            {card.value}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
