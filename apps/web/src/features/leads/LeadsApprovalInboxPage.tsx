'use client';

import { useMemo, useState } from 'react';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import SectionPageView from '@/components/common/page/SectionPageView';
import { Skeleton } from '@/components/ui/skeleton';
import LeadsErrorState from './components/LeadsErrorState';
import LeadsNav from './components/LeadsNav';
import LeadsApprovalFilters from './components/approval/LeadsApprovalFilters';
import LeadsApprovalTable from './components/approval/LeadsApprovalTable';
import {
  useApprovalLeadsQuery,
  useLeadCampaignsQuery,
  type ApprovalLeadFilters,
} from './services/leads.service';

export default function LeadsApprovalInboxPage() {
  const { project } = useShell();
  const { can } = usePermissions();
  const projectKey = project?.project.key ?? '';
  const [filters, setFilters] = useState<ApprovalLeadFilters>({
    reviewStatus: 'ready_for_review',
    sort: 'qualification_desc',
  });
  const [search, setSearch] = useState('');
  const leadsQuery = useApprovalLeadsQuery(projectKey, filters);
  const campaignsQuery = useLeadCampaignsQuery(projectKey);
  const leads = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return leadsQuery.data ?? [];
    return (leadsQuery.data ?? []).filter((lead) =>
      [lead.companyName, lead.campaignName, lead.city, lead.category].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    );
  }, [leadsQuery.data, search]);

  if (!project || leadsQuery.isLoading || campaignsQuery.isLoading)
    return <Skeleton className="m-6 flex-1" />;
  if (!can('leads', 'read')) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        You do not have access to Leads.
      </div>
    );
  }
  if (leadsQuery.isError || campaignsQuery.isError) {
    return (
      <LeadsErrorState
        onRetry={() => {
          void leadsQuery.refetch();
          void campaignsQuery.refetch();
        }}
      />
    );
  }

  return (
    <SectionPageView
      title="Approval Inbox"
      description="Inspect analysed leads. Decisions and outreach are disabled in this read-only view."
      wide
    >
      <LeadsNav projectKey={projectKey} />
      <div className="space-y-4 pb-8">
        <div>
          <h2 className="font-semibold">Leads for review</h2>
          <p className="text-sm text-muted-foreground">
            {leads.length} leads match the current filters
          </p>
        </div>
        <LeadsApprovalFilters
          campaigns={campaignsQuery.data ?? []}
          filters={filters}
          search={search}
          onFiltersChange={setFilters}
          onSearchChange={setSearch}
        />
        {leads.length > 0 ? (
          <LeadsApprovalTable leads={leads} projectKey={projectKey} />
        ) : (
          <p className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            No leads match the current filters.
          </p>
        )}
      </div>
    </SectionPageView>
  );
}
