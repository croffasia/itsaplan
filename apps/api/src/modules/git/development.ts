import { db, issue, issueDevelopmentCheck, issueDevelopmentLink } from '@repo/db';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { iso } from '#shared/lib';
import type {
  BranchEvent,
  CheckEvent,
  GitProviderKey,
  PipelineEvent,
  PipelineStatus,
  PullRequestEvent,
  PullRequestState,
} from './providers';

export interface DevelopmentCheck {
  id: number;
  name: string;
  status: PipelineStatus;
  url: string | null;
  updatedAt: string;
}

export interface DevelopmentLink {
  id: number;
  provider: GitProviderKey;
  repository: string;
  kind: 'pull_request' | 'branch';
  number: number | null;
  title: string;
  url: string | null;
  state: PullRequestState;
  draft: boolean;
  sourceBranch: string | null;
  targetBranch: string;
  headSha: string | null;
  pipelineStatus: PipelineStatus | null;
  pipelineUrl: string | null;
  checkStatus: PipelineStatus | null;
  checks: DevelopmentCheck[];
  updatedAt: string;
}

function pullRequestState(event: PullRequestEvent): PullRequestState {
  if (event.action === 'merged') return 'merged';
  if (event.action === 'closed') return 'closed';
  return 'open';
}

function projectIssue(projectId: number) {
  return inArray(
    issueDevelopmentLink.issueId,
    db.select({ id: issue.id }).from(issue).where(eq(issue.projectId, projectId)),
  );
}

function aggregateChecks(checks: DevelopmentCheck[]): PipelineStatus | null {
  if (checks.length === 0) return null;
  if (checks.some((check) => check.status === 'failed')) return 'failed';
  if (checks.some((check) => check.status === 'running')) return 'running';
  if (checks.some((check) => check.status === 'pending')) return 'pending';
  if (checks.some((check) => check.status === 'canceled')) return 'canceled';
  if (checks.every((check) => check.status === 'skipped')) return 'skipped';
  return 'success';
}

export async function listIssueDevelopmentLinks(issueId: number): Promise<DevelopmentLink[]> {
  const links = await db
    .select()
    .from(issueDevelopmentLink)
    .where(eq(issueDevelopmentLink.issueId, issueId))
    .orderBy(desc(issueDevelopmentLink.updatedAt), desc(issueDevelopmentLink.id));
  const rows = links.length
    ? await db
        .select()
        .from(issueDevelopmentCheck)
        .where(
          inArray(
            issueDevelopmentCheck.developmentLinkId,
            links.map((link) => link.id),
          ),
        )
        .orderBy(issueDevelopmentCheck.name, desc(issueDevelopmentCheck.updatedAt))
    : [];
  return links.map((link) => {
    const checks = rows
      .filter((row) => row.developmentLinkId === link.id && row.headSha === link.headSha)
      .map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status as PipelineStatus,
        url: row.url,
        updatedAt: iso(row.updatedAt),
      }));
    return {
      ...link,
      provider: link.provider as GitProviderKey,
      kind: link.kind === 'branch' ? 'branch' : 'pull_request',
      state: link.state as PullRequestState,
      pipelineStatus: link.pipelineStatus as PipelineStatus | null,
      checkStatus: aggregateChecks(checks),
      checks,
      updatedAt: iso(link.updatedAt),
    };
  });
}

export async function hasOpenDevelopmentLinks(issueId: number): Promise<boolean> {
  const [link] = await db
    .select({ id: issueDevelopmentLink.id })
    .from(issueDevelopmentLink)
    .where(
      and(
        eq(issueDevelopmentLink.issueId, issueId),
        eq(issueDevelopmentLink.kind, 'pull_request'),
        eq(issueDevelopmentLink.state, 'open'),
      ),
    )
    .limit(1);
  return link != null;
}

export async function removeIssueDevelopmentLink(
  issueId: number,
  linkId: number,
): Promise<boolean> {
  const removed = await db
    .delete(issueDevelopmentLink)
    .where(and(eq(issueDevelopmentLink.id, linkId), eq(issueDevelopmentLink.issueId, issueId)))
    .returning({ id: issueDevelopmentLink.id });
  return removed.length > 0;
}

function pullRequestValues(event: PullRequestEvent, updatedAt: Date) {
  return {
    kind: 'pull_request' as const,
    externalKey: `pull_request:${event.number}`,
    number: event.number,
    title: event.title,
    url: event.url,
    state: pullRequestState(event),
    draft: event.draft,
    sourceBranch: event.sourceBranch,
    targetBranch: event.targetBranch,
    headSha: event.headSha,
    updatedAt,
  };
}

function pullRequestUpdateValues(event: PullRequestEvent, updatedAt: Date) {
  const values = pullRequestValues(event, updatedAt);
  if (!event.headSha || event.action === 'merged') return values;
  return {
    ...values,
    pipelineStatus: sql<
      string | null
    >`CASE WHEN ${issueDevelopmentLink.headSha} IS DISTINCT FROM ${event.headSha} THEN NULL ELSE ${issueDevelopmentLink.pipelineStatus} END`,
    pipelineUrl: sql<
      string | null
    >`CASE WHEN ${issueDevelopmentLink.headSha} IS DISTINCT FROM ${event.headSha} THEN NULL ELSE ${issueDevelopmentLink.pipelineUrl} END`,
  };
}

export async function updatePullRequestLinks(
  projectId: number,
  provider: GitProviderKey,
  event: PullRequestEvent,
): Promise<void> {
  await db
    .update(issueDevelopmentLink)
    .set(pullRequestUpdateValues(event, new Date()))
    .where(
      and(
        eq(issueDevelopmentLink.provider, provider),
        eq(issueDevelopmentLink.repository, event.repo),
        eq(issueDevelopmentLink.externalKey, `pull_request:${event.number}`),
        projectIssue(projectId),
      ),
    );
}

export async function upsertPullRequestLinks(
  issueIds: number[],
  provider: GitProviderKey,
  event: PullRequestEvent,
): Promise<number[]> {
  if (issueIds.length === 0) return [];
  const existing = await db
    .select({ issueId: issueDevelopmentLink.issueId })
    .from(issueDevelopmentLink)
    .where(
      and(
        inArray(issueDevelopmentLink.issueId, issueIds),
        eq(issueDevelopmentLink.provider, provider),
        eq(issueDevelopmentLink.repository, event.repo),
        eq(issueDevelopmentLink.externalKey, `pull_request:${event.number}`),
      ),
    );
  const existingIssueIds = new Set(existing.map((link) => link.issueId));
  const values = pullRequestValues(event, new Date());
  const updateValues = pullRequestUpdateValues(event, values.updatedAt);
  await db
    .insert(issueDevelopmentLink)
    .values(
      issueIds.map((issueId) => ({
        issueId,
        provider,
        repository: event.repo,
        ...values,
      })),
    )
    .onConflictDoUpdate({
      target: [
        issueDevelopmentLink.issueId,
        issueDevelopmentLink.provider,
        issueDevelopmentLink.repository,
        issueDevelopmentLink.externalKey,
      ],
      set: updateValues,
    });
  return issueIds.filter((issueId) => !existingIssueIds.has(issueId));
}

export async function removePullRequestLinks(
  issueIds: number[],
  provider: GitProviderKey,
  event: PullRequestEvent,
): Promise<void> {
  if (issueIds.length === 0) return;
  await db
    .delete(issueDevelopmentLink)
    .where(
      and(
        inArray(issueDevelopmentLink.issueId, issueIds),
        eq(issueDevelopmentLink.provider, provider),
        eq(issueDevelopmentLink.repository, event.repo),
        eq(issueDevelopmentLink.externalKey, `pull_request:${event.number}`),
      ),
    );
}

export async function upsertBranchLinks(
  issueIds: number[],
  provider: GitProviderKey,
  event: BranchEvent,
): Promise<void> {
  if (issueIds.length === 0) return;
  const updatedAt = new Date();
  await db
    .insert(issueDevelopmentLink)
    .values(
      issueIds.map((issueId) => ({
        issueId,
        provider,
        repository: event.repo,
        kind: 'branch',
        externalKey: `branch:${event.branch}`,
        number: null,
        title: event.branch,
        url: event.url,
        state: 'open',
        draft: false,
        sourceBranch: event.branch,
        targetBranch: event.defaultBranch ?? '',
        headSha: event.headSha,
        updatedAt,
      })),
    )
    .onConflictDoUpdate({
      target: [
        issueDevelopmentLink.issueId,
        issueDevelopmentLink.provider,
        issueDevelopmentLink.repository,
        issueDevelopmentLink.externalKey,
      ],
      set: {
        title: event.branch,
        url: event.url,
        targetBranch: event.defaultBranch ?? '',
        headSha: event.headSha,
        updatedAt,
      },
    });
}

export async function removeBranchLinks(
  projectId: number,
  issueIds: number[] | null,
  provider: GitProviderKey,
  repo: string,
  branch: string,
): Promise<void> {
  if (issueIds?.length === 0) return;
  await db
    .delete(issueDevelopmentLink)
    .where(
      and(
        issueIds ? inArray(issueDevelopmentLink.issueId, issueIds) : undefined,
        eq(issueDevelopmentLink.provider, provider),
        eq(issueDevelopmentLink.repository, repo),
        eq(issueDevelopmentLink.externalKey, `branch:${branch}`),
        projectIssue(projectId),
      ),
    );
}

// A branch can receive CI before its pull request exists. Promote that row when
// the pull request arrives so its pipeline and check rows survive the transition.
// If the pull request row already exists, only remove the now-redundant branch row.
export async function promoteBranchLinksToPullRequest(
  issueIds: number[],
  provider: GitProviderKey,
  event: PullRequestEvent,
): Promise<number[]> {
  if (issueIds.length === 0 || !event.sourceBranch) return [];
  const branchKey = `branch:${event.sourceBranch}`;
  const pullRequestKey = `pull_request:${event.number}`;
  return db.transaction(async (tx) => {
    const links = await tx
      .select({
        id: issueDevelopmentLink.id,
        issueId: issueDevelopmentLink.issueId,
        externalKey: issueDevelopmentLink.externalKey,
      })
      .from(issueDevelopmentLink)
      .where(
        and(
          inArray(issueDevelopmentLink.issueId, issueIds),
          eq(issueDevelopmentLink.provider, provider),
          eq(issueDevelopmentLink.repository, event.repo),
          inArray(issueDevelopmentLink.externalKey, [branchKey, pullRequestKey]),
        ),
      );
    const pullRequestIssueIds = new Set(
      links.filter((link) => link.externalKey === pullRequestKey).map((link) => link.issueId),
    );
    const branchLinks = links.filter((link) => link.externalKey === branchKey);
    const promoted = branchLinks.filter((link) => !pullRequestIssueIds.has(link.issueId));
    const redundant = branchLinks.filter((link) => pullRequestIssueIds.has(link.issueId));

    if (promoted.length > 0) {
      await tx
        .update(issueDevelopmentLink)
        .set(pullRequestUpdateValues(event, new Date()))
        .where(
          inArray(
            issueDevelopmentLink.id,
            promoted.map((link) => link.id),
          ),
        );
    }
    if (redundant.length > 0) {
      await tx.delete(issueDevelopmentLink).where(
        inArray(
          issueDevelopmentLink.id,
          redundant.map((link) => link.id),
        ),
      );
    }
    return promoted.map((link) => link.issueId);
  });
}

export async function updatePipelineLinks(
  projectId: number,
  provider: GitProviderKey,
  event: PipelineEvent,
): Promise<void> {
  const identity = event.pullRequestNumber
    ? eq(issueDevelopmentLink.externalKey, `pull_request:${event.pullRequestNumber}`)
    : event.headSha
      ? eq(issueDevelopmentLink.headSha, event.headSha)
      : null;
  if (!identity) return;
  const currentHead = event.headSha
    ? or(isNull(issueDevelopmentLink.headSha), eq(issueDevelopmentLink.headSha, event.headSha))
    : undefined;
  await db
    .update(issueDevelopmentLink)
    .set({
      pipelineStatus: event.status,
      pipelineUrl: event.url,
      ...(event.headSha ? { headSha: event.headSha } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(issueDevelopmentLink.provider, provider),
        eq(issueDevelopmentLink.repository, event.repo),
        identity,
        currentHead,
        projectIssue(projectId),
      ),
    );
}

export async function updateCheckLinks(
  projectId: number,
  provider: GitProviderKey,
  event: CheckEvent,
): Promise<void> {
  const identity = event.pullRequestNumbers.length
    ? inArray(
        issueDevelopmentLink.externalKey,
        event.pullRequestNumbers.map((number) => `pull_request:${number}`),
      )
    : eq(issueDevelopmentLink.headSha, event.headSha);
  const links = await db
    .select({ id: issueDevelopmentLink.id })
    .from(issueDevelopmentLink)
    .where(
      and(
        eq(issueDevelopmentLink.provider, provider),
        eq(issueDevelopmentLink.repository, event.repo),
        identity,
        eq(issueDevelopmentLink.headSha, event.headSha),
        projectIssue(projectId),
      ),
    );
  if (links.length === 0) return;
  const updatedAt = new Date();
  await db
    .insert(issueDevelopmentCheck)
    .values(
      links.map(({ id }) => ({
        developmentLinkId: id,
        externalId: event.externalId,
        appId: event.appId,
        name: event.name,
        status: event.status,
        url: event.url,
        headSha: event.headSha,
        updatedAt,
      })),
    )
    .onConflictDoUpdate({
      target: [
        issueDevelopmentCheck.developmentLinkId,
        issueDevelopmentCheck.appId,
        issueDevelopmentCheck.name,
      ],
      set: {
        externalId: event.externalId,
        name: event.name,
        status: event.status,
        url: event.url,
        headSha: event.headSha,
        updatedAt,
      },
    });
}
