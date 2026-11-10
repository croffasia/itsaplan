import { getIssueBySequence, updateIssue } from '#modules/issues/service';
import { recordActivity, textSide, type ActivityActor } from '#modules/issues/activity';
import { getReviewTriggerAgent } from '#modules/agents/core/service';
import { resolveMentionHandles } from '#shared/mentions';
import { enqueueAgentRun } from '#modules/agents/core/run-queue';
import {
  parseIssueIdentifiers,
  parseMagicWords,
  type IssueRef,
  type ParsedMagicWords,
} from './magic-words';
import {
  hasOpenDevelopmentLinks,
  listPullRequestIssueIds,
  promoteBranchLinksToPullRequest,
  removeBranchLinks,
  removePullRequestLinks,
  updateCheckLinks,
  updatePipelineLinks,
  updatePullRequestLinks,
  upsertBranchLinks,
  upsertPullRequestLinks,
} from './development';
import type {
  GitEvent,
  GitProviderKey,
  PullRequestEvent,
  PullRequestReviewEvent,
  PullRequestReviewState,
} from './providers';
import { columnStateTypes, firstCompletedColumnId, type GitSettings } from './service';
import { postPullRequestLinkback } from './connections-service';
import { issueWebPath } from '#modules/teams/ref';

// Stores normalized repository events and applies pull request automation:
// - a pull request merged into the repository's default branch moves the issues
//   named by a closing magic word to the configured (or first completed) column;
// - a pull request opened, or a draft marked ready, links every issue it names,
//   and moves the ones still in a backlog or unstarted column to the configured
//   column, when one is set.
// Every move goes through updateIssue, so the status activity entry, outgoing
// webhooks, subtask automation, and notifications fire as for a user's move.

const CLOSED_STATE_TYPES = ['completed', 'canceled'];

export type PullRequestOutcome = 'merged' | 'opened' | 'reviewed' | 'ignored';

const refId = (ref: IssueRef) => `${ref.key}-${ref.sequenceNumber}`;

function uniqueRefs(refs: IssueRef[]): IssueRef[] {
  return [...new Map(refs.map((ref) => [refId(ref), ref])).values()];
}

async function resolveIssues(
  project: { id: number; key: string },
  refs: IssueRef[],
): Promise<{ id: number; sequenceNumber: number }[]> {
  const projectKey = project.key.toUpperCase();
  const linked = [];
  for (const ref of uniqueRefs(refs)) {
    if (ref.key !== projectKey) continue;
    const issue = await getIssueBySequence(project.id, ref.sequenceNumber);
    if (issue && !issue.archivedAt)
      linked.push({ id: issue.id, sequenceNumber: issue.sequenceNumber });
  }
  return linked;
}

export async function handleGitEvent(
  project: { id: number; key: string; teamRef: string },
  settings: GitSettings,
  providerKey: GitProviderKey,
  providerLabel: string,
  event: GitEvent,
): Promise<PullRequestOutcome | 'branch' | 'pipeline' | 'check'> {
  if (event.kind === 'check') {
    await updateCheckLinks(project.id, providerKey, event);
    return 'check';
  }
  if (event.kind === 'pipeline') {
    await updatePipelineLinks(project.id, providerKey, event);
    return 'pipeline';
  }
  if (event.kind === 'pull_request_review') {
    return handlePullRequestReview(project.id, providerKey, providerLabel, event);
  }

  if (event.kind === 'branch') {
    if (event.action === 'deleted') {
      await removeBranchLinks(project.id, null, providerKey, event.repo, event.branch);
      return 'branch';
    }
    const branchIssues = await resolveIssues(project, parseIssueIdentifiers(event.branch));
    await upsertBranchLinks(
      branchIssues.map((issue) => issue.id),
      providerKey,
      event,
    );
    return 'branch';
  }

  await updatePullRequestLinks(project.id, providerKey, event);
  const magic = parseMagicWords(`${event.title}\n${event.body}`);
  const skipped = new Set(magic.skipped.map(refId));
  const branchRefs = parseIssueIdentifiers(event.sourceBranch ?? '').filter(
    (ref) => !skipped.has(refId(ref)),
  );
  const refs: ParsedMagicWords = {
    closes: magic.closes,
    references: uniqueRefs([...magic.references, ...branchRefs]).filter(
      (ref) => !magic.closes.some((closing) => refId(closing) === refId(ref)),
    ),
    skipped: magic.skipped,
  };
  const skippedIssues = await resolveIssues(project, magic.skipped);
  await removePullRequestLinks(
    skippedIssues.map((issue) => issue.id),
    providerKey,
    event,
  );
  if (event.sourceBranch) {
    await removeBranchLinks(
      project.id,
      skippedIssues.map((issue) => issue.id),
      providerKey,
      event.repo,
      event.sourceBranch,
    );
  }
  const projectKey = project.key.toUpperCase();
  const uniqueIssues = await resolveIssues(project, [...refs.closes, ...refs.references]);
  const promotedIssueIds = await promoteBranchLinksToPullRequest(
    uniqueIssues.map((issue) => issue.id),
    providerKey,
    event,
  );
  const insertedIssueIds = await upsertPullRequestLinks(
    uniqueIssues.map((item) => item.id),
    providerKey,
    event,
  );
  const newIssueIds = [...new Set([...promotedIssueIds, ...insertedIssueIds])];
  if (settings.linkbackComments && newIssueIds.length > 0) {
    const appUrl = process.env.APP_URL?.replace(/\/$/, '');
    const items = uniqueIssues
      .filter((item) => newIssueIds.includes(item.id))
      .map((item) => {
        const identifier = `${projectKey}-${item.sequenceNumber}`;
        return appUrl
          ? `- [${identifier}](${appUrl}${issueWebPath(project.teamRef, project.key, item.sequenceNumber)})`
          : `- ${identifier}`;
      });
    try {
      await postPullRequestLinkback(
        project.id,
        providerKey,
        event.repo,
        event.number,
        `Linked to ${items.length === 1 ? 'an issue' : 'issues'} in It's a Plan:\n\n${items.join('\n')}`,
      );
    } catch {
      // Development linking is the primary action. A revoked provider token must
      // not make a verified webhook fail or repeat its issue automation.
    }
  }
  return handlePullRequestEvent(project, settings, providerLabel, event, refs);
}

// Who an entry is by: the tracker user whose handle is the repository login, when the
// login is one of the project's agents or members, else the login itself, else the
// provider when the payload names nobody. An agent that opened the pull request thus
// appears as itself on the issue.
async function repositoryActor(
  projectId: number,
  login: string | null,
  providerLabel: string,
): Promise<ActivityActor> {
  if (!login) return { system: providerLabel };
  const found = await resolveMentionHandles(projectId, [login.toLowerCase()]);
  return found.agentUserIds[0] ?? found.memberIds[0] ?? { system: login };
}

export async function handlePullRequestEvent(
  project: { id: number; key: string },
  settings: GitSettings,
  providerLabel: string,
  event: PullRequestEvent,
  parsed = parseMagicWords(`${event.title}\n${event.body}`),
): Promise<PullRequestOutcome> {
  const actor = await repositoryActor(
    project.id,
    event.action === 'merged' ? event.mergedBy : event.author,
    providerLabel,
  );
  const projectKey = project.key.toUpperCase();
  const inProject = (refs: IssueRef[]) => refs.filter((r) => r.key === projectKey);
  const prEntry = (outcome: string) => ({
    action: 'git_pr',
    subject: textSide(outcome),
    // The pull request is not a row of this database: the repository and the number
    // are what identifies it.
    from: { value: `${event.repo}#${event.number}`, repo: event.repo, number: event.number },
    to: textSide(event.url),
  });

  if (event.action === 'merged') {
    if (event.defaultBranch != null && event.targetBranch !== event.defaultBranch) return 'ignored';
    const targetId = await mergeTargetColumnId(project.id, settings);
    if (targetId == null) return 'ignored';
    for (const ref of inProject(parsed.closes)) {
      const issue = await getIssueBySequence(project.id, ref.sequenceNumber);
      // An issue moved to another project keeps its pull requests, but the columns
      // configured here are not its columns.
      if (!issue || issue.archivedAt || issue.projectId !== project.id) continue;
      // A task may need several pull requests. Wait for all linked work to leave
      // the open state before applying the merge automation, as Linear does.
      if (await hasOpenDevelopmentLinks(issue.id)) continue;
      const stateType = (await columnStateTypes([issue.columnId])).get(issue.columnId);
      if (stateType && CLOSED_STATE_TYPES.includes(stateType)) continue;
      await recordActivity(issue.id, [prEntry('merged')], actor);
      await updateIssue(issue.id, { columnId: targetId }, actor, {
        skipIfColumnFull: true,
      });
    }
    return 'merged';
  }

  if (event.action === 'updated' || event.action === 'closed') return 'ignored';

  if (event.draft) return 'ignored';
  const targetId = await openTargetColumnId(settings);
  for (const ref of inProject([...parsed.closes, ...parsed.references])) {
    const issue = await getIssueBySequence(project.id, ref.sequenceNumber);
    if (!issue || issue.archivedAt) continue;
    await recordActivity(issue.id, [prEntry('opened')], actor);
    if (targetId == null || issue.columnId === targetId || issue.projectId !== project.id) continue;
    const stateType = (await columnStateTypes([issue.columnId])).get(issue.columnId);
    // Only pull work forward: an issue already started or closed stays put.
    // The guard makes that atomic — a user moving the issue between this read
    // and the write wins over the automation.
    if (stateType === 'backlog' || stateType === 'unstarted')
      await updateIssue(issue.id, { columnId: targetId }, actor, {
        onlyIfColumnId: issue.columnId,
        skipIfColumnFull: true,
      });
  }
  return 'opened';
}

// The configured merge target if it still exists, else the first completed column.
async function mergeTargetColumnId(
  projectId: number,
  settings: GitSettings,
): Promise<number | null> {
  const configured = settings.onMergeColumnId;
  if (configured != null && (await columnStateTypes([configured])).has(configured))
    return configured;
  return firstCompletedColumnId(projectId);
}

// The configured open target if it still exists; null means the automation is off.
async function openTargetColumnId(settings: GitSettings): Promise<number | null> {
  const configured = settings.onOpenColumnId;
  if (configured != null && (await columnStateTypes([configured])).has(configured))
    return configured;
  return null;
}

const REVIEW_VERBS: Record<PullRequestReviewState, string> = {
  approved: 'approved',
  changes_requested: 'requested changes on',
  commented: 'commented on',
};

// A review of a linked pull request is recorded on each issue the pull request is
// linked to, by the reviewer. When the pull request was opened by an
// agent of the project, the review is handed to it as a run on the first of those
// issues, once, however many issues the pull request names. A review the author
// wrote on its own pull request starts nothing.
async function handlePullRequestReview(
  projectId: number,
  providerKey: GitProviderKey,
  providerLabel: string,
  event: PullRequestReviewEvent,
): Promise<PullRequestOutcome> {
  const issueIds = await listPullRequestIssueIds(projectId, providerKey, event.repo, event.number);
  if (issueIds.length === 0) return 'ignored';
  const entry = {
    action: 'git_pr',
    subject: textSide(event.state),
    from: { value: `${event.repo}#${event.number}`, repo: event.repo, number: event.number },
    to: textSide(event.url),
  };
  const actor = await repositoryActor(projectId, event.reviewer, providerLabel);
  for (const issueId of issueIds) {
    await recordActivity(issueId, [entry], actor);
  }
  if (!event.author || event.author.toLowerCase() === event.reviewer.toLowerCase()) {
    return 'reviewed';
  }
  const agent = await getReviewTriggerAgent(projectId, event.author);
  if (!agent) return 'reviewed';
  const where = event.url ? ` (${event.url})` : '';
  const text = event.body.trim();
  await enqueueAgentRun({
    agentId: agent.id,
    projectId,
    issueId: issueIds[0]!,
    sourceActivityId: null,
    trigger: 'review',
    prompt:
      `${event.reviewer} ${REVIEW_VERBS[event.state]} pull request ${event.repo}#${event.number}${where}.` +
      (text ? `\n\n${text}` : ''),
  });
  return 'reviewed';
}
