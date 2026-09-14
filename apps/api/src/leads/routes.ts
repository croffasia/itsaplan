import { Elysia, t } from 'elysia';
import { guards } from '../shared/guards';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import { getLeadDetail, listApprovalLeads, listLeadAgentRuns, listLeadCampaigns } from './store';

const NullableString = t.Nullable(t.String());
const NullableNumber = t.Nullable(t.Number());
const NullableBoolean = t.Nullable(t.Boolean());

const CampaignResponse = t.Object({
  id: t.String(),
  name: t.String(),
  niche: NullableString,
  location: NullableString,
  source: t.String(),
  targetLeads: NullableNumber,
  sourcingLimit: NullableNumber,
  foundResults: t.Number(),
  validLeads: t.Number(),
  rejectedResults: t.Number(),
  completedAnalyses: t.Number(),
  failedAnalyses: t.Number(),
  remainingLeads: t.Number(),
  status: t.String(),
  sourcingStatus: NullableString,
  exportStatus: t.String(),
  outreachStatus: t.Literal('disabled'),
  startedAt: NullableString,
  completedAt: NullableString,
  updatedAt: t.String(),
});

const ApprovalLeadResponse = t.Object({
  id: t.String(),
  companyId: t.String(),
  companyName: t.String(),
  campaignId: t.String(),
  campaignName: t.String(),
  category: NullableString,
  city: NullableString,
  postalCode: NullableString,
  phone: NullableString,
  website: NullableString,
  websiteStatus: t.String(),
  reviewStatus: t.String(),
  qualificationScore: t.Number(),
  digitalOpportunityScore: t.Number(),
  businessFit: t.String(),
  recommendation: t.String(),
  recommendedService: NullableString,
  evaluatedAt: t.String(),
  updatedAt: t.String(),
  outreachStatus: t.Literal('disabled'),
});

const AuditResponse = t.Nullable(
  t.Object({
    status: t.String(),
    finalUrl: NullableString,
    httpStatus: NullableNumber,
    responseMs: NullableNumber,
    httpsEnabled: NullableBoolean,
    title: NullableString,
    metaDescription: NullableString,
    hasViewportMeta: NullableBoolean,
    h1Count: NullableNumber,
    formCount: NullableNumber,
    telLinkCount: NullableNumber,
    bookingLinkCount: NullableNumber,
    imagesMissingAlt: NullableNumber,
    visualInspected: t.Boolean(),
    desktopFindings: t.Array(t.String()),
    mobileFindings: t.Array(t.String()),
    technicalFindings: t.Array(t.String()),
    auditedAt: NullableString,
  }),
);

const LeadDetailResponse = t.Object({
  id: t.String(),
  companyId: t.String(),
  companyName: t.String(),
  category: NullableString,
  address: NullableString,
  city: NullableString,
  postalCode: NullableString,
  countryCode: NullableString,
  phone: NullableString,
  publicBusinessEmail: NullableString,
  website: NullableString,
  googleMapsUrl: NullableString,
  googlePlaceId: NullableString,
  lifecycleStatus: t.String(),
  contactStatus: t.String(),
  timesSeen: t.Number(),
  campaignId: t.String(),
  campaignName: t.String(),
  reviewStatus: t.String(),
  websiteStatus: NullableString,
  websiteQualityScore: NullableNumber,
  digitalOpportunityScore: NullableNumber,
  qualificationScore: NullableNumber,
  businessFit: NullableString,
  recommendation: NullableString,
  recommendedService: NullableString,
  findings: t.Array(t.String()),
  opportunities: t.Array(t.String()),
  evaluationStatus: NullableString,
  modelName: NullableString,
  evaluatedAt: NullableString,
  audit: AuditResponse,
  evidence: t.Array(t.Object({ type: t.String(), url: t.String() })),
  source: t.Object({
    type: NullableString,
    url: NullableString,
    actorRunId: NullableString,
    datasetId: NullableString,
    collectedAt: NullableString,
  }),
  campaignHistory: t.Array(
    t.Object({
      leadId: t.String(),
      campaignId: t.String(),
      campaignName: t.String(),
      reviewStatus: t.String(),
      firstAddedAt: t.String(),
      lastSeenAt: t.String(),
    }),
  ),
  outreachStatus: t.Literal('disabled'),
  firstAddedAt: t.String(),
  lastSeenAt: t.String(),
});

const AgentRunResponse = t.Object({
  id: t.String(),
  type: t.Literal('google_maps_sourcing'),
  campaignId: NullableString,
  campaignName: t.String(),
  provider: t.String(),
  status: t.String(),
  phase: t.String(),
  startedAt: t.String(),
  updatedAt: t.String(),
  completedAt: NullableString,
  requested: t.Number(),
  processed: t.Number(),
  succeeded: t.Number(),
  failed: t.Number(),
  errorCode: NullableString,
  retryStatus: t.String(),
  reconciliationStatus: t.String(),
});

const protectedResponses = {
  401: ErrorResponse,
  403: ErrorResponse,
  404: ErrorResponse,
  503: ErrorResponse,
};

function assertLeadsProject(projectKey: string): void {
  const allowedProjectKey = process.env.VEXOL_LEADS_PROJECT_KEY;
  if (!allowedProjectKey) throw new HttpError(503, 'Leads project is not configured');
  if (projectKey.toLowerCase() !== allowedProjectKey.toLowerCase()) {
    throw new HttpError(404, 'Leads are not available for this project');
  }
}

export const leadRoutes = new Elysia({ name: 'leads', detail: { tags: ['Leads'] } })
  .use(guards)
  .get(
    '/projects/:projectKey/leads/campaigns',
    ({ project }) => {
      assertLeadsProject(project.key);
      return listLeadCampaigns();
    },
    {
      permission: ['leads', 'read'],
      response: { 200: t.Array(CampaignResponse), ...protectedResponses },
      detail: { summary: "List the Vexol project's lead campaigns" },
    },
  )
  .get(
    '/projects/:projectKey/leads/approval-inbox',
    ({ project, query }) => {
      assertLeadsProject(project.key);
      return listApprovalLeads({
        campaignId: query.campaignId,
        reviewStatus: query.reviewStatus,
        sort: query.sort,
        limit: query.limit ?? 50,
        offset: query.offset ?? 0,
      });
    },
    {
      permission: ['leads', 'read'],
      query: t.Object({
        campaignId: t.Optional(t.String({ format: 'uuid' })),
        reviewStatus: t.Optional(
          t.UnionEnum([
            'new',
            'researching',
            'ready_for_review',
            'approved',
            'rejected',
            'possible_duplicate',
            'archived',
          ]),
        ),
        sort: t.Optional(t.UnionEnum(['qualification_desc', 'newest', 'oldest'])),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
        offset: t.Optional(t.Numeric({ minimum: 0, maximum: 10_000 })),
      }),
      response: { 200: t.Array(ApprovalLeadResponse), 400: ErrorResponse, ...protectedResponses },
      detail: { summary: 'List analysed leads awaiting or carrying a review decision' },
    },
  )
  .get(
    '/projects/:projectKey/leads/agent-runs',
    ({ project }) => {
      assertLeadsProject(project.key);
      return listLeadAgentRuns();
    },
    {
      permission: ['leads', 'read'],
      response: { 200: t.Array(AgentRunResponse), ...protectedResponses },
      detail: { summary: 'List read-only lead sourcing run status' },
    },
  )
  .get(
    '/projects/:projectKey/leads/:leadId',
    async ({ params, project }) => {
      assertLeadsProject(project.key);
      const lead = await getLeadDetail(params.leadId);
      if (!lead) throw new HttpError(404, 'Lead not found');
      return lead;
    },
    {
      permission: ['leads', 'read'],
      params: t.Object({ projectKey: t.String(), leadId: t.String({ format: 'uuid' }) }),
      response: { 200: LeadDetailResponse, 400: ErrorResponse, ...protectedResponses },
      detail: { summary: 'Get one read-only lead detail' },
    },
  );
