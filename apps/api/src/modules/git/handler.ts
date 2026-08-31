import { getIssueBySequence, updateIssue } from '#modules/issues/service';
import { recordActivity, textSide, type ActivityActor } from '#modules/issues/activity';
import {
  parseIssueIdentifiers,
  parseMagicWords,
  type IssueRef,
  type ParsedMagicWords,
} from './magic-words';
import {
  hasOpenDevelopmentLinks,
  promoteBranchLinksToPullRequest,
  removeBranchLinks,
  removePullRequestLinks,
  updateCheckLinks,
  updatePipelineLinks,
  updatePullRequestLinks,
  upsertBranchLinks,
  upsertPullRequestLinks,
} from './development';
import type { GitEvent, GitProviderKey, PullRequestEvent } from './providers';
import { columnStateTypes, firstCompletedColumnId, type GitSettings } from './service';
import { postPullRequestLinkback } from './connections-service';

// Stores normalized repository events and applies pull request automation:
// - a pull request merged into the repository's default branch moves the issues
//   named by a closing magic word to the configured (or first completed) column;
// - a pull request opened, or a draft marked ready, links every issue it names,
//   and moves the ones still in a backlog or unstarted column to the configured
//   column, when one is set.
// Every move goes through updateIssue, so the status activity entry, outgoing
// webhooks, subtask automation, and notifications fire as for a user's move.

const CLOSED_STATE_TYPES = ['completed', 'canceled'];

export type PullRequestOutcome = 'merged' | 'opened' | 'ignored';

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
  project: { id: number; key: string },
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
          ? `- [${identifier}](${appUrl}/project/${project.key}/issue/${item.sequenceNumber})`
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

export async function handlePullRequestEvent(
  project: { id: number; key: string },
  settings: GitSettings,
  providerLabel: string,
  event: PullRequestEvent,
  parsed = parseMagicWords(`${event.title}\n${event.body}`),
): Promise<PullRequestOutcome> {
  const actor: ActivityActor = { system: providerLabel };
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
      if (!issue || issue.archivedAt) continue;
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
    if (targetId == null || issue.columnId === targetId) continue;
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
