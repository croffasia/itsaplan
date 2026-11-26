import {
  db,
  gitCommentLink,
  gitIssueLink,
  gitManagedRepository,
  gitProviderConnection,
  issue,
  issueActivity,
  issueAttachment,
} from '@repo/db';
import { and, eq, inArray } from 'drizzle-orm';
import { rewriteMentions } from '#shared/mentions';
import type { FeedItemRow } from '#modules/issues/activity';
import { memberAccountInput } from './accounts';
import {
  createProviderIssueComment,
  deleteProviderIssueComment,
  updateProviderIssueComment,
  type ProviderRepository,
} from './connections-provider';
import { gitIntegrationEnabled } from './service';
import type { GitProviderKey } from './providers';

// Comments written here on an issue synced two ways go to its repository issue, under
// the author's own account on the host (user_git_account). An author without one keeps
// the comment here only: the team's token never writes comments.

// Ends every comment written to a repository issue from here, so its webhook comes back
// recognised instead of copied as a new comment.
export const SYNC_MARKER = '<!-- itsaplan -->';

// A handle here is not the host's user of the same name: the zero-width space keeps the
// host from notifying them.
const QUIET_AT = '@&#8203;';

const MEDIA_LINK = /\/media\/attachments\/([0-9a-f-]{36})\/raw/g;

function webOrigin(): string | undefined {
  return process.env.APP_URL?.split(',')[0]?.trim() || undefined;
}

// A file here is named by the web app's path, which means nothing on the host: one copied
// from the host goes back to its address there, any other to its full address here.
async function toRepositoryText(body: string, issueId: number): Promise<string> {
  const text = rewriteMentions(body, (handle) => `${QUIET_AT}${handle}`);
  const ids = [...new Set(Array.from(text.matchAll(MEDIA_LINK), (match) => match[1]!))];
  const copies =
    ids.length === 0
      ? []
      : await db
          .select({ publicId: issueAttachment.publicId, sourceUrl: issueAttachment.sourceUrl })
          .from(issueAttachment)
          .where(and(eq(issueAttachment.issueId, issueId), inArray(issueAttachment.publicId, ids)));
  const sourceUrls = new Map(copies.map((copy) => [copy.publicId, copy.sourceUrl]));
  const origin = webOrigin();
  const linked = text.replace(
    MEDIA_LINK,
    (path, id: string) => sourceUrls.get(id) ?? (origin ? `${origin}${path}` : path),
  );
  return `${linked}\n\n${SYNC_MARKER}`;
}

// The text of a repository comment as it reads here: the reverse of toRepositoryText. The
// host's addresses of files copied here turn back into the copies in copyRepositoryFiles.
export function fromRepositoryText(body: string): string {
  const trimmed = body.trimEnd();
  const text = trimmed.endsWith(SYNC_MARKER)
    ? trimmed.slice(0, -SYNC_MARKER.length).trimEnd()
    : body;
  const origin = webOrigin();
  const unquiet = text.replaceAll(QUIET_AT, '@');
  return origin
    ? unquiet.replaceAll(`${origin}/media/attachments/`, '/media/attachments/')
    : unquiet;
}

interface PushTarget {
  repositoryId: number;
  baseUrl: string;
  number: number;
  repository: ProviderRepository;
}

// The repository issue an issue is linked to, while comments written here go to it.
async function pushTarget(issueId: number): Promise<PushTarget | null> {
  const [row] = await db
    .select({
      repositoryId: gitManagedRepository.id,
      projectId: gitManagedRepository.projectId,
      baseUrl: gitProviderConnection.baseUrl,
      number: gitIssueLink.number,
      externalId: gitManagedRepository.externalId,
      fullName: gitManagedRepository.fullName,
      webUrl: gitManagedRepository.webUrl,
    })
    .from(gitIssueLink)
    .innerJoin(issue, eq(gitIssueLink.issueId, issue.id))
    .innerJoin(gitManagedRepository, eq(gitIssueLink.repositoryId, gitManagedRepository.id))
    .innerJoin(
      gitProviderConnection,
      eq(gitManagedRepository.connectionId, gitProviderConnection.id),
    )
    .where(
      and(
        eq(gitIssueLink.issueId, issueId),
        // An issue moved to another project no longer syncs.
        eq(issue.projectId, gitManagedRepository.projectId),
        eq(gitManagedRepository.issueSync, 'two_way'),
        eq(gitManagedRepository.issueComments, true),
        eq(gitManagedRepository.issueCommentsPush, true),
      ),
    )
    .limit(1);
  if (!row || !(await gitIntegrationEnabled(row.projectId))) return null;
  return {
    repositoryId: row.repositoryId,
    baseUrl: row.baseUrl,
    number: row.number,
    repository: {
      externalId: row.externalId,
      fullName: row.fullName,
      webUrl: row.webUrl,
      private: false,
    },
  };
}

async function linkedCommentId(activityId: number, repositoryId: number): Promise<string | null> {
  const [row] = await db
    .select({ externalId: gitCommentLink.externalId })
    .from(gitCommentLink)
    .where(
      and(eq(gitCommentLink.activityId, activityId), eq(gitCommentLink.repositoryId, repositoryId)),
    )
    .limit(1);
  return row?.externalId ?? null;
}

// The comment here has already changed, so a failure is recorded on the repository,
// where the settings show it, and not thrown.
async function pushing(target: PushTarget, what: string, push: () => Promise<void>): Promise<void> {
  try {
    await push();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Comment sync failed';
    const issueRef = `${target.repository.fullName}#${target.number}`;
    await db
      .update(gitManagedRepository)
      .set({ lastError: `${issueRef}: ${message}`, updatedAt: new Date() })
      .where(eq(gitManagedRepository.id, target.repositoryId));
    console.error(`[git] could not ${what} a comment on ${issueRef}:`, error);
  }
}

// A comment by a member, written here. One that came from the repository is already there.
export async function pushCreatedComment(comment: FeedItemRow): Promise<void> {
  if (!comment.actorUserId || comment.actorSource || !comment.body) return;
  const target = await pushTarget(comment.issueId);
  if (!target) return;
  const account = await memberAccountInput(comment.actorUserId, target.baseUrl);
  if (!account) return;
  await pushing(target, 'write', async () => {
    const externalId = await createProviderIssueComment(
      account,
      target.repository,
      target.number,
      await toRepositoryText(comment.body!, comment.issueId),
    );
    await db
      .insert(gitCommentLink)
      .values({ repositoryId: target.repositoryId, activityId: comment.id, externalId })
      .onConflictDoNothing();
  });
}

// An edit or a delete reaches the repository comment through its author's account, the
// only one that may change it there.
async function linkedTarget(comment: FeedItemRow) {
  if (!comment.actorUserId) return null;
  const target = await pushTarget(comment.issueId);
  if (!target) return null;
  const externalId = await linkedCommentId(comment.id, target.repositoryId);
  if (!externalId) return null;
  const account = await memberAccountInput(comment.actorUserId, target.baseUrl);
  return account ? { target, externalId, account } : null;
}

// The host gets an edit only from the comment's author: a project owner who edits a
// member's comment must not write there as that member.
export async function pushEditedComment(comment: FeedItemRow, editorId: string | null) {
  if (editorId === null || editorId !== comment.actorUserId || !comment.body) return;
  const linked = await linkedTarget(comment);
  if (!linked) return;
  const { target, externalId, account } = linked;
  await pushing(target, 'edit', async () =>
    updateProviderIssueComment(
      account,
      target.repository,
      target.number,
      externalId,
      await toRepositoryText(comment.body!, comment.issueId),
    ),
  );
}

// The delete a comment deleted here sends to the host, read while its row still holds its
// link. It is sent after the row goes, so the host's webhook for it finds no link and
// changes nothing here. As with an edit, only the author's own delete reaches the host.
export async function hostCommentDelete(
  comment: FeedItemRow,
  deleterId: string | null,
): Promise<() => Promise<void>> {
  const linked =
    deleterId !== null && deleterId === comment.actorUserId ? await linkedTarget(comment) : null;
  return async () => {
    if (!linked) return;
    const { target, externalId, account } = linked;
    await pushing(target, 'delete', () =>
      deleteProviderIssueComment(account, target.repository, target.number, externalId),
    );
  };
}

// Whether the issue is linked to a repository issue, whatever its sync settings.
export async function isRepositoryIssue(issueId: number): Promise<boolean> {
  const [row] = await db
    .select({ issueId: gitIssueLink.issueId })
    .from(gitIssueLink)
    .innerJoin(issue, eq(gitIssueLink.issueId, issue.id))
    .innerJoin(gitManagedRepository, eq(gitIssueLink.repositoryId, gitManagedRepository.id))
    .where(
      and(eq(gitIssueLink.issueId, issueId), eq(issue.projectId, gitManagedRepository.projectId)),
    )
    .limit(1);
  return row !== undefined;
}

export interface RepositoryComment {
  provider: GitProviderKey;
  url: string;
}

// Where each of these comments is on its repository issue, for the ones that have a copy
// there. GitLab names a comment on its page note_<id>, the others issuecomment-<id>.
export async function repositoryComments(
  activityIds: number[],
): Promise<Map<number, RepositoryComment>> {
  if (activityIds.length === 0) return new Map();
  const rows = await db
    .select({
      activityId: gitCommentLink.activityId,
      externalId: gitCommentLink.externalId,
      issueUrl: gitIssueLink.url,
      provider: gitProviderConnection.provider,
    })
    .from(gitCommentLink)
    .innerJoin(issueActivity, eq(gitCommentLink.activityId, issueActivity.id))
    .innerJoin(
      gitIssueLink,
      and(
        eq(gitIssueLink.repositoryId, gitCommentLink.repositoryId),
        eq(gitIssueLink.issueId, issueActivity.issueId),
      ),
    )
    .innerJoin(gitManagedRepository, eq(gitCommentLink.repositoryId, gitManagedRepository.id))
    .innerJoin(
      gitProviderConnection,
      eq(gitManagedRepository.connectionId, gitProviderConnection.id),
    )
    .where(inArray(gitCommentLink.activityId, activityIds));
  const links = new Map<number, RepositoryComment>();
  for (const row of rows) {
    if (!row.issueUrl) continue;
    const anchor = row.provider === 'gitlab' ? 'note_' : 'issuecomment-';
    links.set(row.activityId, {
      provider: row.provider as GitProviderKey,
      url: `${row.issueUrl}#${anchor}${row.externalId}`,
    });
  }
  return links;
}
