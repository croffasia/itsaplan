import { getIssueBySequence, updateIssue } from '../../issues/store';
import { recordActivity, type ActivityActor } from '../../issues/activity';
import { parseMagicWords, type IssueRef } from './magic-words';
import { columnStateTypes, firstCompletedColumnId, type GithubSettings } from './service';

// Applies a GitHub pull_request delivery to the project's issues:
// - a PR merged into the repository's default branch moves the issues named by a
//   closing magic word to the configured (or first completed) column;
// - a PR opened (non-draft) links every issue it mentions, and moves the ones
//   still in a backlog/unstarted column to the configured column, when one is set.
// Every move goes through updateIssue, so the status activity entry, outgoing
// webhooks, subtask automation, and notifications fire as for a user's move.

const GITHUB_ACTOR: ActivityActor = { system: 'GitHub' };
const CLOSED_STATE_TYPES = ['completed', 'canceled'];

// The payload's PR URL is rendered as a link in the feed; only http(s) is stored
// so a crafted delivery cannot plant a javascript: (or other scheme) href.
function httpUrl(url: string): string | null {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
}

// The slice of GitHub's pull_request event payload this handler reads.
export interface PullRequestPayload {
  action: string;
  pull_request: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    merged: boolean;
    draft: boolean;
    base: { ref: string };
  };
  repository: { full_name: string; default_branch: string };
}

export type PullRequestOutcome = 'merged' | 'opened' | 'ignored';

export async function handlePullRequestEvent(
  project: { id: number; key: string },
  settings: GithubSettings,
  payload: PullRequestPayload,
): Promise<PullRequestOutcome> {
  const pr = payload.pull_request;
  const parsed = parseMagicWords(`${pr.title}\n${pr.body ?? ''}`);
  const projectKey = project.key.toUpperCase();
  const inProject = (refs: IssueRef[]) => refs.filter((r) => r.key === projectKey);
  const prEntry = (subject: string) => ({
    action: 'github_pr',
    subject,
    fromText: `${payload.repository.full_name}#${pr.number}`,
    toText: httpUrl(pr.html_url),
  });

  if (payload.action === 'closed' && pr.merged) {
    if (pr.base.ref !== payload.repository.default_branch) return 'ignored';
    const targetId = await mergeTargetColumnId(project.id, settings);
    if (targetId == null) return 'ignored';
    for (const ref of inProject(parsed.closes)) {
      const issue = await getIssueBySequence(project.id, ref.sequenceNumber);
      if (!issue || issue.archivedAt) continue;
      const stateType = (await columnStateTypes([issue.columnId])).get(issue.columnId);
      if (stateType && CLOSED_STATE_TYPES.includes(stateType)) continue;
      await recordActivity(issue.id, [prEntry('merged')], GITHUB_ACTOR);
      await updateIssue(issue.id, { columnId: targetId }, GITHUB_ACTOR, {
        skipIfColumnFull: true,
      });
    }
    return 'merged';
  }

  if (payload.action === 'opened' && !pr.draft) {
    const targetId = await openTargetColumnId(settings);
    for (const ref of inProject([...parsed.closes, ...parsed.references])) {
      const issue = await getIssueBySequence(project.id, ref.sequenceNumber);
      if (!issue || issue.archivedAt) continue;
      await recordActivity(issue.id, [prEntry('opened')], GITHUB_ACTOR);
      if (targetId == null || issue.columnId === targetId) continue;
      const stateType = (await columnStateTypes([issue.columnId])).get(issue.columnId);
      // Only pull work forward: an issue already started or closed stays put.
      // The guard makes that atomic — a user moving the issue between this read
      // and the write wins over the automation.
      if (stateType === 'backlog' || stateType === 'unstarted')
        await updateIssue(issue.id, { columnId: targetId }, GITHUB_ACTOR, {
          onlyIfColumnId: issue.columnId,
          skipIfColumnFull: true,
        });
    }
    return 'opened';
  }

  return 'ignored';
}

// The configured merge target if it still exists, else the first completed column.
async function mergeTargetColumnId(
  projectId: number,
  settings: GithubSettings,
): Promise<number | null> {
  const configured = settings.onMergeColumnId;
  if (configured != null && (await columnStateTypes([configured])).has(configured))
    return configured;
  return firstCompletedColumnId(projectId);
}

// The configured open target if it still exists; null means the automation is off.
async function openTargetColumnId(settings: GithubSettings): Promise<number | null> {
  const configured = settings.onOpenColumnId;
  if (configured != null && (await columnStateTypes([configured])).has(configured))
    return configured;
  return null;
}
