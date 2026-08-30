import { getIssueBySequence, updateIssue } from '#modules/issues/service';
import { recordActivity, textSide, type ActivityActor } from '#modules/issues/activity';
import { parseMagicWords, type IssueRef } from './magic-words';
import {
  hasOpenDevelopmentLinks,
  updateCheckLinks,
  updatePipelineLinks,
  updatePullRequestLinks,
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

export async function handleGitEvent(
  project: { id: number; key: string },
  settings: GitSettings,
  providerKey: GitProviderKey,
  providerLabel: string,
  event: GitEvent,
): Promise<PullRequestOutcome | 'pipeline' | 'check'> {
  if (event.kind === 'check') {
    await updateCheckLinks(project.id, providerKey, event);
    return 'check';
  }
  if (event.kind === 'pipeline') {
    await updatePipelineLinks(project.id, providerKey, event);
    return 'pipeline';
  }

  await updatePullRequestLinks(project.id, providerKey, event);
  const refs = parseMagicWords(`${event.title}\n${event.body}`);
  const projectKey = project.key.toUpperCase();
  const linkedIssues: { id: number; sequenceNumber: number }[] = [];
  for (const ref of [...refs.closes, ...refs.references]) {
    if (ref.key !== projectKey) continue;
    const linkedIssue = await getIssueBySequence(project.id, ref.sequenceNumber);
    if (linkedIssue && !linkedIssue.archivedAt)
      linkedIssues.push({
        id: linkedIssue.id,
        sequenceNumber: linkedIssue.sequenceNumber,
      });
  }
  const uniqueIssues = [...new Map(linkedIssues.map((item) => [item.id, item])).values()];
  const newIssueIds = await upsertPullRequestLinks(
    uniqueIssues.map((item) => item.id),
    providerKey,
    event,
  );
  if (newIssueIds.length > 0) {
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
