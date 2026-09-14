'use client';

import { useParams } from 'next/navigation';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import SectionPageView from '@/components/common/page/SectionPageView';
import { Skeleton } from '@/components/ui/skeleton';
import LeadsErrorState from './components/LeadsErrorState';
import LeadsNav from './components/LeadsNav';
import LeadsStatusBadge from './components/LeadsStatusBadge';
import LeadAnalysisCard from './components/detail/LeadAnalysisCard';
import LeadOverviewCard from './components/detail/LeadOverviewCard';
import LeadSourceCard from './components/detail/LeadSourceCard';
import LeadWebsiteAuditCard from './components/detail/LeadWebsiteAuditCard';
import { useLeadQuery } from './services/leads.service';

export default function LeadDetailPage() {
  const params = useParams<{ leadId: string }>();
  const { project } = useShell();
  const { can } = usePermissions();
  const projectKey = project?.project.key ?? '';
  const leadQuery = useLeadQuery(projectKey, params.leadId ?? '');

  if (!project || leadQuery.isLoading) return <Skeleton className="m-6 flex-1" />;
  if (!can('leads', 'read')) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        You do not have access to Leads.
      </div>
    );
  }
  if (leadQuery.isError) {
    return <LeadsErrorState onRetry={() => void leadQuery.refetch()} />;
  }
  if (!leadQuery.data) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Lead not found.
      </div>
    );
  }

  const lead = leadQuery.data;
  return (
    <SectionPageView
      title={lead.companyName}
      description={
        <span className="flex items-center gap-2">
          <LeadsStatusBadge status={lead.reviewStatus} />
          <span>{lead.campaignName} · Read only</span>
        </span>
      }
      wide
    >
      <LeadsNav projectKey={projectKey} />
      <div className="grid gap-4 pb-8 xl:grid-cols-2">
        <LeadOverviewCard lead={lead} />
        <LeadAnalysisCard lead={lead} />
        <LeadWebsiteAuditCard lead={lead} />
        <LeadSourceCard lead={lead} />
      </div>
    </SectionPageView>
  );
}
