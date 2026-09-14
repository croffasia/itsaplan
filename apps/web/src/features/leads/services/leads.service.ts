import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export interface ApprovalLeadFilters {
  campaignId?: string;
  reviewStatus?: string;
  sort?: 'qualification_desc' | 'newest' | 'oldest';
}

export function useLeadCampaignsQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.leadCampaigns(projectKey),
    queryFn: () => api.listLeadCampaigns(projectKey),
    enabled: projectKey.length > 0,
  });
}

export function useApprovalLeadsQuery(projectKey: string, filters: ApprovalLeadFilters) {
  return useQuery({
    queryKey: qk.approvalLeads(projectKey, filters),
    queryFn: () => api.listApprovalLeads(projectKey, filters),
    enabled: projectKey.length > 0,
  });
}

export function useLeadQuery(projectKey: string, leadId: string) {
  return useQuery({
    queryKey: qk.lead(projectKey, leadId),
    queryFn: () => api.getLead(projectKey, leadId),
    enabled: projectKey.length > 0 && leadId.length > 0,
  });
}

export function useLeadAgentRunsQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.leadAgentRuns(projectKey),
    queryFn: () => api.listLeadAgentRuns(projectKey),
    enabled: projectKey.length > 0,
  });
}
