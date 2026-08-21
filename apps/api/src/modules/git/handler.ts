import { getIssueBySequence, updateIssue } from '../../issues/store';
import { recordActivity, type ActivityActor } from '../../issues/activity';
import { parseMagicWords, type IssueRef } from './magic-words';
import type { PullRequestEvent } from './providers';
import { columnStateTypes, firstCompletedColumnId, type GitSettings } from './service';

// Applies a normalized pull request event to the project's issues:
// - a pull request merged into the repository's default branch moves the issues
//   named by a closing magic word to the configured (or first completed) column;
// - a pull request opened, or a draft marked ready, links every issue it names,
//   and moves the ones still in a backlog or unstarted column to the configured
//   column, when one is set.
// Every move goes through updateIssue, so the status activity entry, outgoing
// webhooks, subtask automation, and notifications fire as for a user's move.

const CLOSED_STATE_TYPES = ['completed', 'canceled'];

export type PullRequestOutcome = 'merged' | 'opened' | 'ignored';

export async function handlePullRequestEvent(
  project: { id: number; key: string },
  settings: GitSettings,
  providerLabel: string,
  event: PullRequestEvent,
): Promise<PullRequestOutcome> {
  const actor: ActivityActor = { system: providerLabel };
  const parsed = parseMagicWords(`${event.title}\n${event.body}`);
  const projectKey = project.key.toUpperCase();
  const inProject = (refs: IssueRef[]) => refs.filter((r) => r.key === projectKey);
  const prEntry = (subject: string) => ({
    action: 'git_pr',
    subject,
    fromText: `${event.repo}#${event.number}`,
    toText: event.url,
  });

  if (event.action === 'merged') {
    if (event.defaultBranch != null && event.targetBranch !== event.defaultBranch) return 'ignored';
    const targetId = await mergeTargetColumnId(project.id, settings);
    if (targetId == null) return 'ignored';
    for (const ref of inProject(parsed.closes)) {
      const issue = await getIssueBySequence(project.id, ref.sequenceNumber);
      if (!issue || issue.archivedAt) continue;
      const stateType = (await columnStateTypes([issue.columnId])).get(issue.columnId);
      if (stateType && CLOSED_STATE_TYPES.includes(stateType)) continue;
      await recordActivity(issue.id, [prEntry('merged')], actor);
      await updateIssue(issue.id, { columnId: targetId }, actor, {
        skipIfColumnFull: true,
      });
    }
    return 'merged';
  }

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
