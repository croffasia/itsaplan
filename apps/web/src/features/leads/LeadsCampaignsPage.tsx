'use client';

import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import SectionPageView from '@/components/common/page/SectionPageView';
import { Skeleton } from '@/components/ui/skeleton';
import LeadsErrorState from './components/LeadsErrorState';
import LeadsNav from './components/LeadsNav';
import LeadsCampaignSummaryCards from './components/campaigns/LeadsCampaignSummaryCards';
import LeadsCampaignsTable from './components/campaigns/LeadsCampaignsTable';
import { useLeadCampaignsQuery } from './services/leads.service';

export default function LeadsCampaignsPage() {
  const { project } = useShell();
  const { can } = usePermissions();
  const projectKey = project?.project.key ?? '';
  const campaignsQuery = useLeadCampaignsQuery(projectKey);

  if (!project || campaignsQuery.isLoading) return <Skeleton className="m-6 flex-1" />;
  if (!can('leads', 'read')) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        You do not have access to Leads.
      </div>
    );
  }
  if (campaignsQuery.isError) {
    return <LeadsErrorState onRetry={() => void campaignsQuery.refetch()} />;
  }

  const campaigns = campaignsQuery.data ?? [];
  return (
    <SectionPageView
      title="Leads"
      description="Read-only campaign progress from the Vexol lead system."
      wide
    >
      <LeadsNav projectKey={projectKey} />
      <div className="space-y-6 pb-8">
        <LeadsCampaignSummaryCards campaigns={campaigns} />
        <section className="space-y-3">
          <div>
            <h2 className="font-semibold">Campaigns</h2>
            <p className="text-sm text-muted-foreground">
              {campaigns.length} campaigns in the lead database
            </p>
          </div>
          {campaigns.length > 0 ? (
            <LeadsCampaignsTable campaigns={campaigns} />
          ) : (
            <p className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
              No campaigns found.
            </p>
          )}
        </section>
      </div>
    </SectionPageView>
  );
}
