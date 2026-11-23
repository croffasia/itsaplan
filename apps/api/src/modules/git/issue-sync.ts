import {
  db,
  gitIssueLink,
  gitManagedRepository,
  gitProviderConnection,
  gitRepositoryLabel,
  issue,
} from '@repo/db';
import { and, asc, eq, inArray, isNull, lt, ne, sql } from 'drizzle-orm';
import { HttpError } from '#shared/lib';
import {
  createIssue,
  getIssue,
  setIssueLabels,
  updateIssue,
  type IssuePatch,
  type IssueRow,
} from '#modules/issues/service';
import { createComment, type ActivityActor } from '#modules/issues/activity';
import { getProjectById, type ProjectRow } from '#modules/projects/service';
import {
  PROVIDER_LABEL,
  listProviderOpenIssues,
  setProviderIssueState,
  type GitProvider,
} from './connections-provider';
import { providerCallArgs, providerCallColumns } from './connections-service';
import type { GitProviderKey, IssueCommentEvent, IssueEvent, IssueSnapshot } from './providers';
import { columnStateTypes, firstColumnId, gitIntegrationEnabled } from './service';

// Issue sync between a connected repository and its project. In both modes a new
// repository issue becomes an issue here, and moving that issue between an open and a
// closed state closes or reopens the repository issue. In 'two_way' mode a change of
// the repository issue (title, description, labels, state) also comes back here.

const CLOSED_STATE_TYPES = ['completed', 'canceled'];

type IssueSyncMode = 'one_way' | 'two_way';

interface SyncedRepository {
  id: number;
  projectId: number;
  issueSync: IssueSyncMode;
  issueColumnId: number | null;
  issueComments: boolean;
}

export interface LinkedRepositoryIssue {
  provider: GitProvider;
  repository: string;
  number: number;
  url: string | null;
  state: 'open' | 'closed';
}

const syncedColumns = {
  id: gitManagedRepository.id,
  projectId: gitManagedRepository.projectId,
  issueSync: gitManagedRepository.issueSync,
  issueColumnId: gitManagedRepository.issueColumnId,
  issueComments: gitManagedRepository.issueComments,
};

function synced(
  row: Omit<SyncedRepository, 'issueSync'> & { issueSync: string },
): SyncedRepository {
  return { ...row, issueSync: row.issueSync === 'two_way' ? 'two_way' : 'one_way' };
}

// A Forgejo server labels its deliveries 'forgejo' even on a connection saved as Gitea.
function providerKeys(key: GitProviderKey): string[] {
  return key === 'gitea' || key === 'forgejo' ? ['gitea', 'forgejo'] : [key];
}

// The repository of the project a delivery came from, while its issue sync is on. A
// repository connected only by a webhook made by hand has no row and never syncs issues.
async function syncedRepository(
  projectId: number,
  providerKey: GitProviderKey,
  repo: string,
): Promise<SyncedRepository | null> {
  const [row] = await db
    .select(syncedColumns)
    .from(gitManagedRepository)
    .innerJoin(
      gitProviderConnection,
      eq(gitManagedRepository.connectionId, gitProviderConnection.id),
    )
    .where(
      and(
        eq(gitManagedRepository.projectId, projectId),
        inArray(gitProviderConnection.provider, providerKeys(providerKey)),
        sql`lower(${gitManagedRepository.fullName}) = lower(${repo})`,
        ne(gitManagedRepository.issueSync, 'off'),
      ),
    )
    .limit(1);
  return row ? synced(row) : null;
}

function authorName(author: string | null, providerLabel: string): string {
  return author ? `${author} (${providerLabel})` : providerLabel;
}

async function intakeColumnId(repository: SyncedRepository): Promise<number> {
  const columnId = repository.issueColumnId ?? (await firstColumnId(repository.projectId));
  if (columnId == null) throw new HttpError(400, 'The project has no columns');
  return columnId;
}

interface MappedTargets {
  labelIds: number[];
  // The labels this repository maps, so a change keeps every other label of the issue.
  mappedLabelIds: Set<number>;
  // The type of the issue's first label, by name, that maps to one.
  typeId: number | null;
}

async function mappedTargets(repositoryId: number, labels: string[]): Promise<MappedTargets> {
  const rows = await db
    .select({
      externalName: gitRepositoryLabel.externalName,
      labelId: gitRepositoryLabel.labelId,
      typeId: gitRepositoryLabel.typeId,
    })
    .from(gitRepositoryLabel)
    .where(eq(gitRepositoryLabel.repositoryId, repositoryId))
    .orderBy(asc(gitRepositoryLabel.externalName));
  const present = rows.filter((row) => labels.includes(row.externalName));
  const ids = (list: typeof rows) =>
    list.flatMap((row) => (row.labelId == null ? [] : [row.labelId]));
  return {
    labelIds: [...new Set(ids(present))],
    mappedLabelIds: new Set(ids(rows)),
    typeId: present.find((row) => row.typeId != null)?.typeId ?? null,
  };
}

// A claim the process that made it never finished or released: it stopped in between.
const staleClaim = () => sql`now() - interval '10 minutes'`;

// Inserts the link before the issue exists, so two deliveries or imports of one
// repository issue cannot both create it. Returns null when it is already linked.
async function claimIssueLink(repositoryId: number, snapshot: IssueSnapshot) {
  const sameIssue = and(
    eq(gitIssueLink.repositoryId, repositoryId),
    eq(gitIssueLink.number, snapshot.number),
  );
  await db
    .delete(gitIssueLink)
    .where(and(sameIssue, isNull(gitIssueLink.issueId), lt(gitIssueLink.createdAt, staleClaim())));
  const [claim] = await db
    .insert(gitIssueLink)
    .values({
      repositoryId,
      number: snapshot.number,
      url: snapshot.url,
      state: snapshot.state,
    })
    .onConflictDoNothing()
    .returning({ id: gitIssueLink.id });
  return claim?.id ?? null;
}

// Creates the issue a repository issue becomes. Returns false when it already has one.
// A full column still takes it: the repository sends the issue once and never retries.
async function createLinkedIssue(
  project: ProjectRow,
  repository: SyncedRepository,
  snapshot: IssueSnapshot,
  providerLabel: string,
  opts?: { skipStatusRuns?: boolean },
): Promise<boolean> {
  const claimId = await claimIssueLink(repository.id, snapshot);
  if (claimId == null) return false;
  try {
    const mapped = await mappedTargets(repository.id, snapshot.labels);
    const created = await createIssue(
      project,
      {
        columnId: await intakeColumnId(repository),
        title: snapshot.title || `#${snapshot.number}`,
        description: snapshot.body,
        labelIds: mapped.labelIds,
        ...(mapped.typeId != null ? { typeId: mapped.typeId } : {}),
      },
      { system: authorName(snapshot.author, providerLabel) },
      { skipWipLimit: true, skipStatusRuns: opts?.skipStatusRuns },
    );
    await db.update(gitIssueLink).set({ issueId: created.id }).where(eq(gitIssueLink.id, claimId));
    return true;
  } catch (error) {
    await db.delete(gitIssueLink).where(eq(gitIssueLink.id, claimId));
    throw error;
  }
}

// An issue moved to another project keeps its link but no longer syncs: that
// project's members may have no access to the repository.
async function linkedIssue(repository: SyncedRepository, number: number) {
  const [link] = await db
    .select({ id: gitIssueLink.id, issueId: issue.id })
    .from(gitIssueLink)
    .innerJoin(issue, eq(gitIssueLink.issueId, issue.id))
    .where(
      and(
        eq(gitIssueLink.repositoryId, repository.id),
        eq(gitIssueLink.number, number),
        eq(issue.projectId, repository.projectId),
      ),
    )
    .limit(1);
  return link ?? null;
}

// Where an issue goes when the repository closes or reopens it; null keeps it in place.
async function stateTargetColumnId(
  repository: SyncedRepository,
  columnId: number,
  snapshot: IssueSnapshot,
): Promise<number | null> {
  const stateType = (await columnStateTypes([columnId])).get(columnId) ?? '';
  const closedHere = CLOSED_STATE_TYPES.includes(stateType);
  if (snapshot.state === 'open') return closedHere ? intakeColumnId(repository) : null;
  if (closedHere) return null;
  if (snapshot.stateReason === 'not_planned') {
    const canceled = await firstColumnId(repository.projectId, 'canceled');
    if (canceled != null) return canceled;
  }
  return firstColumnId(repository.projectId, 'completed');
}

// Labels mapped from this repository follow the repository issue; every other label
// of the issue stays.
async function applyLabels(
  repository: SyncedRepository,
  current: IssueRow,
  mapped: MappedTargets,
  actor: ActivityActor,
): Promise<void> {
  const next = [
    ...new Set([
      ...current.labelIds.filter((id) => !mapped.mappedLabelIds.has(id)),
      ...mapped.labelIds,
    ]),
  ];
  const unchanged =
    next.length === current.labelIds.length && next.every((id) => current.labelIds.includes(id));
  if (!unchanged) await setIssueLabels(repository.projectId, current.id, next, actor);
}

async function applyIssueChange(
  repository: SyncedRepository,
  event: IssueEvent,
  providerLabel: string,
): Promise<boolean> {
  const link = await linkedIssue(repository, event.number);
  if (!link) return false;
  // Stored before the move below, so the move does not send the state back.
  await db
    .update(gitIssueLink)
    .set({ state: event.state, url: event.url })
    .where(eq(gitIssueLink.id, link.id));
  const changed = new Set(event.changed);
  const current = await getIssue(link.issueId);
  if (!current || current.archivedAt) return false;
  const actor: ActivityActor = { system: providerLabel };
  const patch: IssuePatch = {};
  if (changed.has('title') && event.title && event.title !== current.title)
    patch.title = event.title;
  if (changed.has('body') && event.body !== current.description) patch.description = event.body;
  if (changed.has('state')) {
    const columnId = await stateTargetColumnId(repository, current.columnId, event);
    if (columnId != null) patch.columnId = columnId;
  }
  const mapped = changed.has('labels') ? await mappedTargets(repository.id, event.labels) : null;
  // A removed label never clears the type: only a newly mapped one replaces it.
  if (mapped?.typeId != null && mapped.typeId !== current.typeId) patch.typeId = mapped.typeId;
  if (Object.keys(patch).length > 0)
    await updateIssue(current.id, patch, actor, { skipIfColumnFull: true });
  if (mapped) await applyLabels(repository, current, mapped, actor);
  return true;
}

export async function handleIssueEvent(
  project: ProjectRow,
  providerKey: GitProviderKey,
  providerLabel: string,
  event: IssueEvent,
): Promise<'issue' | 'ignored'> {
  const repository = await syncedRepository(project.id, providerKey, event.repo);
  if (!repository) return 'ignored';
  if (event.action === 'opened') {
    await createLinkedIssue(project, repository, event, providerLabel);
    return 'issue';
  }
  if (repository.issueSync !== 'two_way') return 'ignored';
  return (await applyIssueChange(repository, event, providerLabel)) ? 'issue' : 'ignored';
}

export async function handleIssueComment(
  project: ProjectRow,
  providerKey: GitProviderKey,
  providerLabel: string,
  event: IssueCommentEvent,
): Promise<'comment' | 'ignored'> {
  const repository = await syncedRepository(project.id, providerKey, event.repo);
  if (!repository?.issueComments) return 'ignored';
  const link = await linkedIssue(repository, event.number);
  if (!link) return 'ignored';
  await createComment({
    issueId: link.issueId,
    body: event.body,
    authorName: authorName(event.author, providerLabel),
  });
  return 'comment';
}

// Creates an issue for each open issue on one page of the repository's issues. The
// caller walks the pages, so no request runs long; an issue already linked is skipped,
// so a page read twice creates nothing twice.
export async function importRepositoryIssues(
  projectId: number,
  repositoryId: number,
  page: number,
): Promise<{ created: number; skipped: number; nextPage: number | null }> {
  const [row] = await db
    .select({ ...syncedColumns, ...providerCallColumns })
    .from(gitManagedRepository)
    .innerJoin(
      gitProviderConnection,
      eq(gitManagedRepository.connectionId, gitProviderConnection.id),
    )
    .where(
      and(eq(gitManagedRepository.id, repositoryId), eq(gitManagedRepository.projectId, projectId)),
    )
    .limit(1);
  if (!row) throw new HttpError(404, 'Managed repository not found');
  if (row.issueSync === 'off') throw new HttpError(400, 'Issue sync is off for this repository');
  if (!(await gitIntegrationEnabled(projectId)))
    throw new HttpError(400, 'The repository integration is off');
  const project = await getProjectById(projectId);
  if (!project) throw new HttpError(404, 'Project not found');
  const call = providerCallArgs(row);
  const { issues, nextPage } = await listProviderOpenIssues(call.input, call.repository, page);
  const repository = synced(row);
  const providerLabel = PROVIDER_LABEL[call.input.provider];
  // One agent run per imported issue would start hundreds of runs at once.
  const options = { skipStatusRuns: true };
  let created = 0;
  for (const snapshot of issues) {
    if (await createLinkedIssue(project, repository, snapshot, providerLabel, options)) created++;
  }
  return { created, skipped: issues.length - created, nextPage };
}

// The guard of linkedIssue for the way back to the repository.
const sameProject = eq(issue.projectId, gitManagedRepository.projectId);

// Closes or reopens the repository issue linked to an issue that moved between an
// open and a closed state. The move here has already happened, so a failure is
// recorded on the repository, not thrown.
export async function pushLinkedIssueState(issueId: number, columnId: number): Promise<void> {
  const [row] = await db
    .select({
      linkId: gitIssueLink.id,
      repositoryId: gitIssueLink.repositoryId,
      projectId: gitManagedRepository.projectId,
      number: gitIssueLink.number,
      state: gitIssueLink.state,
      ...providerCallColumns,
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
        ne(gitManagedRepository.issueSync, 'off'),
        sameProject,
      ),
    )
    .limit(1);
  if (!row || !(await gitIntegrationEnabled(row.projectId))) return;
  const stateType = (await columnStateTypes([columnId])).get(columnId) ?? '';
  const state = CLOSED_STATE_TYPES.includes(stateType) ? 'closed' : 'open';
  if (row.state === state) return;
  try {
    const call = providerCallArgs(row);
    await setProviderIssueState(
      call.input,
      call.repository,
      row.number,
      state,
      stateType === 'canceled' ? 'not_planned' : 'completed',
    );
    await db.update(gitIssueLink).set({ state }).where(eq(gitIssueLink.id, row.linkId));
    // A webhook error stays until the webhook is fixed.
    await db
      .update(gitManagedRepository)
      .set({ lastError: null })
      .where(
        and(
          eq(gitManagedRepository.id, row.repositoryId),
          eq(gitManagedRepository.status, 'connected'),
        ),
      );
  } catch (error) {
    // Shown on the repository in the settings, where a missing token permission is fixed.
    const message = error instanceof Error ? error.message : 'Issue state update failed';
    await db
      .update(gitManagedRepository)
      .set({ lastError: `${row.fullName}#${row.number}: ${message}`, updatedAt: new Date() })
      .where(eq(gitManagedRepository.id, row.repositoryId));
    console.error(`[git] could not set ${row.fullName}#${row.number} to ${state}:`, error);
  }
}

export async function getLinkedRepositoryIssue(
  issueId: number,
): Promise<LinkedRepositoryIssue | null> {
  const [row] = await db
    .select({
      provider: gitProviderConnection.provider,
      repository: gitManagedRepository.fullName,
      number: gitIssueLink.number,
      url: gitIssueLink.url,
      state: gitIssueLink.state,
    })
    .from(gitIssueLink)
    .innerJoin(issue, eq(gitIssueLink.issueId, issue.id))
    .innerJoin(gitManagedRepository, eq(gitIssueLink.repositoryId, gitManagedRepository.id))
    .innerJoin(
      gitProviderConnection,
      eq(gitManagedRepository.connectionId, gitProviderConnection.id),
    )
    .where(and(eq(gitIssueLink.issueId, issueId), sameProject))
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    provider: row.provider as GitProvider,
    state: row.state === 'closed' ? 'closed' : 'open',
  };
}
