import { firstPartyWebsite, publicEvidence, textItems } from './presenters';
import { withLeadsRead, type LeadsTransaction } from './client';

function iso(value: Date | string | null): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function count(value: unknown): number {
  return Number(value ?? 0);
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function listLeadCampaigns() {
  return withLeadsRead(async (sql) => {
    const rows = await sql`
      select
        c.id, c.name, c.source, c.brief, c.max_leads, c.status,
        c.created_at, c.updated_at,
        count(distinct cl.id)::int as total_leads,
        count(distinct cl.id) filter (where le.evaluation_status = 'completed')::int as completed_analyses,
        count(distinct cl.id) filter (where le.evaluation_status = 'failed')::int as failed_analyses,
        count(distinct cl.id) filter (where cl.review_status = 'ready_for_review')::int as open_reviews,
        count(distinct cl.id) filter (where cl.review_status = 'approved')::int as approved_reviews,
        count(distinct cl.id) filter (where cl.review_status = 'rejected')::int as rejected_reviews,
        sr.status as sourcing_status, sr.requested_limit, sr.created_at as sourcing_started_at,
        sr.updated_at as sourcing_updated_at
      from public.campaigns c
      left join public.campaign_leads cl on cl.campaign_id = c.id
      left join public.lead_evaluations le on le.campaign_lead_id = cl.id
      left join lateral (
        select status, requested_limit, created_at, updated_at
        from public.sourcing_runs
        where campaign_id = c.id
           or (campaign_id is null and lower(campaign_name) = lower(c.name))
        order by updated_at desc
        limit 1
      ) sr on true
      group by c.id, sr.status, sr.requested_limit, sr.created_at, sr.updated_at
      order by c.updated_at desc, c.name
      limit 100
    `;

    return rows.map(mapCampaign);
  });
}

function mapCampaign(row: Record<string, unknown>) {
  const brief = object(row.brief);
  const total = count(row.total_leads);
  const completed = count(row.completed_analyses);
  const failed = count(row.failed_analyses);
  let exportStatus = 'not_ready';
  if (completed > 0) exportStatus = 'partial';
  if (completed === total && total > 0) exportStatus = 'ready';
  return {
    id: String(row.id),
    name: String(row.name),
    niche: text(brief.niche),
    location: text(brief.location ?? brief.geography),
    source: String(row.source),
    targetLeads: count(brief.target_count ?? row.max_leads) || null,
    sourcingLimit: count(row.requested_limit ?? brief.max_leads ?? row.max_leads) || null,
    foundResults: count(brief.found_count) || total,
    validLeads: total,
    rejectedResults: count(brief.rejected_count),
    completedAnalyses: completed,
    failedAnalyses: failed,
    openReviews: count(row.open_reviews),
    approvedReviews: count(row.approved_reviews),
    rejectedReviews: count(row.rejected_reviews),
    remainingLeads: Math.max(0, total - completed - failed),
    status: String(row.status),
    sourcingStatus: text(row.sourcing_status),
    exportStatus,
    outreachStatus: 'disabled' as const,
    startedAt: iso((row.sourcing_started_at ?? row.created_at) as Date | string | null),
    completedAt:
      row.status === 'completed'
        ? iso((row.sourcing_updated_at ?? row.updated_at) as Date | string | null)
        : null,
    updatedAt: iso(row.updated_at as Date | string | null)!,
  };
}

export interface BobCampaignFilters {
  status?: string;
  location?: string;
  niche?: string;
  search?: string;
  page: number;
  pageSize: number;
}

export async function listBobLeadCampaigns(filters: BobCampaignFilters) {
  return withLeadsRead(async (sql) => {
    const status = filters.status ?? null;
    const location = filters.location?.trim() || null;
    const niche = filters.niche?.trim() || null;
    const search = filters.search?.trim() || null;
    const offset = (filters.page - 1) * filters.pageSize;
    const [totalRow] = await sql`
      select count(*)::int as total
      from public.campaigns c
      where (${status}::text is null or c.status = ${status}::text)
        and (${location}::text is null or coalesce(c.brief ->> 'location', c.brief ->> 'geography', '') ilike '%' || ${location}::text || '%')
        and (${niche}::text is null or coalesce(c.brief ->> 'niche', '') ilike '%' || ${niche}::text || '%')
        and (${search}::text is null or c.name ilike '%' || ${search}::text || '%')
    `;
    const rows = await sql`
      select
        c.id, c.name, c.source, c.brief, c.max_leads, c.status,
        c.created_at, c.updated_at,
        count(distinct cl.id)::int as total_leads,
        count(distinct cl.id) filter (where le.evaluation_status = 'completed')::int as completed_analyses,
        count(distinct cl.id) filter (where le.evaluation_status = 'failed')::int as failed_analyses,
        count(distinct cl.id) filter (where cl.review_status = 'ready_for_review')::int as open_reviews,
        count(distinct cl.id) filter (where cl.review_status = 'approved')::int as approved_reviews,
        count(distinct cl.id) filter (where cl.review_status = 'rejected')::int as rejected_reviews,
        sr.status as sourcing_status, sr.requested_limit, sr.created_at as sourcing_started_at,
        sr.updated_at as sourcing_updated_at
      from public.campaigns c
      left join public.campaign_leads cl on cl.campaign_id = c.id
      left join public.lead_evaluations le on le.campaign_lead_id = cl.id
      left join lateral (
        select status, requested_limit, created_at, updated_at
        from public.sourcing_runs
        where campaign_id = c.id
           or (campaign_id is null and lower(campaign_name) = lower(c.name))
        order by updated_at desc
        limit 1
      ) sr on true
      where (${status}::text is null or c.status = ${status}::text)
        and (${location}::text is null or coalesce(c.brief ->> 'location', c.brief ->> 'geography', '') ilike '%' || ${location}::text || '%')
        and (${niche}::text is null or coalesce(c.brief ->> 'niche', '') ilike '%' || ${niche}::text || '%')
        and (${search}::text is null or c.name ilike '%' || ${search}::text || '%')
      group by c.id, sr.status, sr.requested_limit, sr.created_at, sr.updated_at
      order by c.updated_at desc, c.name
      limit ${filters.pageSize} offset ${offset}
    `;
    return {
      items: rows.map(mapCampaign),
      page: filters.page,
      pageSize: filters.pageSize,
      total: count(totalRow.total),
    };
  });
}

export async function getBobLeadSummary() {
  return withLeadsRead(async (sql) => {
    const [row] = await sql`
      select
        count(distinct c.id)::int as campaigns,
        count(distinct cl.id)::int as valid_leads,
        count(distinct cl.id) filter (where le.evaluation_status = 'completed')::int as completed,
        count(distinct cl.id) filter (where le.evaluation_status = 'failed')::int as failed,
        count(distinct cl.id) filter (where cl.review_status = 'ready_for_review')::int as open_reviews
      from public.campaigns c
      left join public.campaign_leads cl on cl.campaign_id = c.id
      left join public.lead_evaluations le on le.campaign_lead_id = cl.id
    `;
    const validLeads = count(row.valid_leads);
    const completed = count(row.completed);
    const failed = count(row.failed);
    return {
      campaigns: count(row.campaigns),
      validLeads,
      remainingEvaluations: Math.max(0, validLeads - completed - failed),
      completed,
      failed,
      openReviews: count(row.open_reviews),
    };
  });
}

export interface BobLeadFilters {
  campaignId?: string;
  reviewStatus?: string;
  evaluationStatus?: string;
  minimumScore?: number;
  search?: string;
  page: number;
  pageSize: number;
}

export async function listBobLeads(filters: BobLeadFilters) {
  return withLeadsRead(async (sql) => {
    if (filters.campaignId) {
      const [campaign] = await sql`
        select id from public.campaigns where id = ${filters.campaignId}::uuid limit 1
      `;
      if (!campaign) return null;
    }
    const campaignId = filters.campaignId ?? null;
    const reviewStatus = filters.reviewStatus ?? null;
    const evaluationStatus = filters.evaluationStatus ?? null;
    const minimumScore = filters.minimumScore ?? null;
    const search = filters.search?.trim() || null;
    const offset = (filters.page - 1) * filters.pageSize;
    const rows = await sql`
      select
        cl.id, cl.review_status, cl.updated_at,
        c.id as campaign_id, c.name as campaign_name,
        co.name as company_name, co.website_url,
        l.category, l.city,
        le.website_status, le.qualification_score, le.business_fit,
        le.recommended_service, le.evaluation_status
      from public.campaign_leads cl
      join public.campaigns c on c.id = cl.campaign_id
      join public.companies co on co.id = cl.company_id
      left join public.lead_evaluations le on le.campaign_lead_id = cl.id
      left join lateral (
        select category, city from public.locations
        where company_id = co.id and is_active = true
        order by last_seen_at desc limit 1
      ) l on true
      where (${campaignId}::uuid is null or c.id = ${campaignId}::uuid)
        and (${reviewStatus}::text is null or cl.review_status = ${reviewStatus}::text)
        and (${evaluationStatus}::text is null or le.evaluation_status = ${evaluationStatus}::text)
        and (${minimumScore}::numeric is null or le.qualification_score >= ${minimumScore}::numeric)
        and (${search}::text is null or co.name ilike '%' || ${search}::text || '%')
      order by cl.updated_at desc, cl.id
      limit ${filters.pageSize} offset ${offset}
    `;
    return {
      items: rows.map((row) => ({
        id: String(row.id),
        campaignId: String(row.campaign_id),
        campaignName: String(row.campaign_name),
        companyName: String(row.company_name),
        category: text(row.category),
        location: text(row.city),
        website: firstPartyWebsite(text(row.website_url), text(row.website_status)),
        websiteStatus: text(row.website_status),
        qualificationScore: row.qualification_score == null ? null : count(row.qualification_score),
        businessFit: text(row.business_fit),
        recommendedService: text(row.recommended_service),
        evaluationStatus: text(row.evaluation_status),
        reviewStatus: String(row.review_status),
        updatedAt: iso(row.updated_at)!,
      })),
      page: filters.page,
      pageSize: filters.pageSize,
      hasMore: rows.length === filters.pageSize,
    };
  });
}

export async function bobLeadExists(leadId: string): Promise<boolean> {
  return withLeadsRead(async (sql) => {
    const [row] = await sql`
      select id from public.campaign_leads where id = ${leadId}::uuid limit 1
    `;
    return Boolean(row);
  });
}

export interface ApprovalFilters {
  campaignId?: string;
  reviewStatus?: string;
  sort?: 'qualification_desc' | 'newest' | 'oldest';
  limit: number;
  offset: number;
}

export async function listApprovalLeads(filters: ApprovalFilters) {
  return withLeadsRead(async (sql) => {
    const campaignId = filters.campaignId ?? null;
    const reviewStatus = filters.reviewStatus ?? null;
    const order = approvalOrder(sql, filters.sort);
    const rows = await sql`
      select
        cl.id, cl.review_status, cl.updated_at,
        c.id as campaign_id, c.name as campaign_name,
        co.id as company_id, co.name as company_name, co.website_url,
        l.category, l.city, l.postal_code, l.phone,
        le.website_status, le.qualification_score, le.digital_opportunity_score,
        le.business_fit, le.recommendation, le.recommended_service, le.evaluated_at
      from public.campaign_leads cl
      join public.campaigns c on c.id = cl.campaign_id
      join public.companies co on co.id = cl.company_id
      join public.lead_evaluations le on le.campaign_lead_id = cl.id
      left join lateral (
        select category, city, postal_code, phone
        from public.locations
        where company_id = co.id and is_active = true
        order by last_seen_at desc
        limit 1
      ) l on true
      where (${campaignId}::uuid is null or c.id = ${campaignId}::uuid)
        and (${reviewStatus}::text is null or cl.review_status = ${reviewStatus}::text)
      order by ${order}
      limit ${filters.limit} offset ${filters.offset}
    `;
    return rows.map((row) => ({
      id: String(row.id),
      companyId: String(row.company_id),
      companyName: String(row.company_name),
      campaignId: String(row.campaign_id),
      campaignName: String(row.campaign_name),
      category: text(row.category),
      city: text(row.city),
      postalCode: text(row.postal_code),
      phone: text(row.phone),
      website: firstPartyWebsite(text(row.website_url), text(row.website_status)),
      websiteStatus: String(row.website_status),
      reviewStatus: String(row.review_status),
      qualificationScore: count(row.qualification_score),
      digitalOpportunityScore: count(row.digital_opportunity_score),
      businessFit: String(row.business_fit),
      recommendation: String(row.recommendation),
      recommendedService: text(row.recommended_service),
      evaluatedAt: iso(row.evaluated_at)!,
      updatedAt: iso(row.updated_at)!,
      outreachStatus: 'disabled' as const,
    }));
  });
}

function approvalOrder(sql: LeadsTransaction, sort: ApprovalFilters['sort']) {
  if (sort === 'oldest') return sql`le.evaluated_at asc, cl.id`;
  if (sort === 'newest') return sql`le.evaluated_at desc, cl.id`;
  return sql`le.qualification_score desc, le.evaluated_at desc, cl.id`;
}

export async function getLeadDetail(leadId: string) {
  return withLeadsRead(async (sql) => {
    const [row] = await sql`
      select
        cl.id, cl.review_status, cl.first_added_at, cl.last_seen_at,
        c.id as campaign_id, c.name as campaign_name,
        co.id as company_id, co.name as company_name, co.website_url,
        co.lifecycle_status, co.contact_status, co.times_seen,
        l.category, l.address, l.city, l.postal_code, l.country_code, l.phone,
        l.google_maps_url, l.google_place_id,
        sr.source, sr.source_url, sr.actor_run_id, sr.dataset_id, sr.collected_at,
        sr.raw_data ->> 'public_business_email' as public_business_email,
        le.website_status, le.website_quality_score, le.digital_opportunity_score,
        le.qualification_score, le.business_fit, le.recommendation,
        le.recommended_service, le.findings, le.opportunities,
        le.evidence as evaluation_evidence, le.evaluation_status, le.model_name,
        le.evaluated_at,
        wa.audit_status, wa.final_url, wa.http_status, wa.response_ms,
        wa.https_enabled, wa.title as website_title, wa.meta_description,
        wa.has_viewport_meta, wa.h1_count, wa.form_count, wa.tel_link_count,
        wa.booking_link_count, wa.images_missing_alt, wa.visual_inspected,
        wa.desktop_findings, wa.mobile_findings, wa.technical_findings,
        wa.evidence as audit_evidence, wa.audited_at
      from public.campaign_leads cl
      join public.campaigns c on c.id = cl.campaign_id
      join public.companies co on co.id = cl.company_id
      left join public.lead_evaluations le on le.campaign_lead_id = cl.id
      left join public.website_audits wa on wa.id = le.website_audit_id
      left join lateral (
        select * from public.locations
        where company_id = co.id and is_active = true
        order by last_seen_at desc limit 1
      ) l on true
      left join lateral (
        select * from public.source_records
        where company_id = co.id
        order by collected_at desc limit 1
      ) sr on true
      where cl.id = ${leadId}::uuid
    `;
    if (!row) return null;

    const history = await sql`
      select cl.id, c.id as campaign_id, c.name as campaign_name,
             cl.review_status, cl.first_added_at, cl.last_seen_at
      from public.campaign_leads cl
      join public.campaigns c on c.id = cl.campaign_id
      where cl.company_id = ${String(row.company_id)}::uuid
      order by cl.last_seen_at desc
    `;
    const websiteType = text(row.website_status);
    return {
      id: String(row.id),
      companyId: String(row.company_id),
      companyName: String(row.company_name),
      category: text(row.category),
      address: text(row.address),
      city: text(row.city),
      postalCode: text(row.postal_code),
      countryCode: text(row.country_code),
      phone: text(row.phone),
      publicBusinessEmail: text(row.public_business_email),
      website: firstPartyWebsite(text(row.website_url), websiteType),
      googleMapsUrl: text(row.google_maps_url),
      googlePlaceId: text(row.google_place_id),
      lifecycleStatus: String(row.lifecycle_status),
      contactStatus: String(row.contact_status),
      timesSeen: count(row.times_seen),
      campaignId: String(row.campaign_id),
      campaignName: String(row.campaign_name),
      reviewStatus: String(row.review_status),
      websiteStatus: websiteType,
      websiteQualityScore:
        row.website_quality_score == null ? null : count(row.website_quality_score),
      digitalOpportunityScore:
        row.digital_opportunity_score == null ? null : count(row.digital_opportunity_score),
      qualificationScore: row.qualification_score == null ? null : count(row.qualification_score),
      businessFit: text(row.business_fit),
      recommendation: text(row.recommendation),
      recommendedService: text(row.recommended_service),
      findings: textItems(row.findings),
      opportunities: textItems(row.opportunities),
      evaluationStatus: text(row.evaluation_status),
      modelName: text(row.model_name),
      evaluatedAt: iso(row.evaluated_at),
      audit: row.audit_status
        ? {
            status: String(row.audit_status),
            finalUrl: firstPartyWebsite(text(row.final_url), websiteType),
            httpStatus: row.http_status == null ? null : count(row.http_status),
            responseMs: row.response_ms == null ? null : count(row.response_ms),
            httpsEnabled: row.https_enabled == null ? null : Boolean(row.https_enabled),
            title: text(row.website_title),
            metaDescription: text(row.meta_description),
            hasViewportMeta: row.has_viewport_meta == null ? null : Boolean(row.has_viewport_meta),
            h1Count: row.h1_count == null ? null : count(row.h1_count),
            formCount: row.form_count == null ? null : count(row.form_count),
            telLinkCount: row.tel_link_count == null ? null : count(row.tel_link_count),
            bookingLinkCount: row.booking_link_count == null ? null : count(row.booking_link_count),
            imagesMissingAlt: row.images_missing_alt == null ? null : count(row.images_missing_alt),
            visualInspected: Boolean(row.visual_inspected),
            desktopFindings: textItems(row.desktop_findings),
            mobileFindings: textItems(row.mobile_findings),
            technicalFindings: textItems(row.technical_findings),
            auditedAt: iso(row.audited_at),
          }
        : null,
      evidence: publicEvidence([
        ...publicEvidence(row.evaluation_evidence),
        ...publicEvidence(row.audit_evidence),
        { evidence_type: row.source, source_url: row.source_url },
      ]),
      source: {
        type: text(row.source),
        url: text(row.source_url),
        actorRunId: text(row.actor_run_id),
        datasetId: text(row.dataset_id),
        collectedAt: iso(row.collected_at),
      },
      campaignHistory: history.map((item) => ({
        leadId: String(item.id),
        campaignId: String(item.campaign_id),
        campaignName: String(item.campaign_name),
        reviewStatus: String(item.review_status),
        firstAddedAt: iso(item.first_added_at)!,
        lastSeenAt: iso(item.last_seen_at)!,
      })),
      outreachStatus: 'disabled' as const,
      firstAddedAt: iso(row.first_added_at)!,
      lastSeenAt: iso(row.last_seen_at)!,
    };
  });
}

export async function listLeadAgentRuns() {
  return withLeadsRead(async (sql) => {
    const rows = await sql`
      select sr.id, sr.campaign_id, sr.campaign_name, sr.provider, sr.actor_id,
             sr.status, sr.requested_limit, sr.created_at, sr.updated_at,
             c.id as resolved_campaign_id,
             count(cl.id)::int as processed,
             count(le.id) filter (where le.evaluation_status = 'completed')::int as succeeded,
             count(le.id) filter (where le.evaluation_status = 'failed')::int as failed
      from public.sourcing_runs sr
      left join public.campaigns c
        on c.id = sr.campaign_id
        or (sr.campaign_id is null and lower(c.name) = lower(sr.campaign_name))
      left join public.campaign_leads cl on cl.campaign_id = c.id
      left join public.lead_evaluations le on le.campaign_lead_id = cl.id
      group by sr.id, c.id
      order by sr.updated_at desc
      limit 100
    `;
    return rows.map((row) => {
      const status = String(row.status);
      let errorCode: string | null = null;
      if (status === 'reconciliation_required') errorCode = 'reconciliation_required';
      if (['failed', 'aborted', 'timed-out'].includes(status)) errorCode = 'sourcing_failed';
      return {
        id: String(row.id),
        type: 'google_maps_sourcing' as const,
        campaignId: row.resolved_campaign_id ? String(row.resolved_campaign_id) : null,
        campaignName: String(row.campaign_name),
        provider: String(row.provider),
        status,
        phase: status === 'succeeded' || status === 'completed' ? 'completed' : 'sourcing',
        startedAt: iso(row.created_at)!,
        updatedAt: iso(row.updated_at)!,
        completedAt: ['succeeded', 'completed', 'failed', 'aborted', 'timed-out'].includes(status)
          ? iso(row.updated_at)
          : null,
        requested: count(row.requested_limit),
        processed: count(row.processed),
        succeeded: count(row.succeeded),
        failed: count(row.failed),
        errorCode,
        retryStatus: status === 'reconciliation_required' ? 'blocked' : 'not_scheduled',
        reconciliationStatus: status === 'reconciliation_required' ? 'required' : 'not_required',
      };
    });
  });
}
