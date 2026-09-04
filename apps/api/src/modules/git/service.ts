import { randomBytes } from 'node:crypto';
import { db, projectColumn, projectSetting } from '@repo/db';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { decryptSecret, encryptSecret, type EncryptedSecret } from '@repo/crypto';
import { HttpError } from '#shared/lib';
import { getProjectSetting } from '#shared/project-settings';

// The shared secret a project hands to its repository host.
const newSecret = () => `whs_${randomBytes(24).toString('hex')}`;

// Exported for the project copier, which must not clone this setting: the copy
// would carry the source's secret and webhook id (a credential disclosure to the
// copy's owner, and ambiguous inbound routing).
export const GIT_SETTING_KEY = 'git';

// The repository hosting config for a project, stored in project_setting under
// GIT_SETTING_KEY. One config serves every provider: `webhookId` routes an incoming
// delivery to the project (it is the unguessable path segment of the payload URL),
// and `secret` authenticates it the way the sending provider supports (a body
// signature or a token header). The secret is encrypted at rest. `onMergeColumnId`
// is the column an issue moves to when a linked pull request merges (null = the
// project's first completed column); `onOpenColumnId` is where an issue moves when a
// linked pull request is opened (null = no action). `repositories` shows the settings
// page which repositories have delivered, and when each of them last did.
interface StoredGitSettings {
  enabled: boolean;
  webhookId: string;
  secret: EncryptedSecret;
  onMergeColumnId: number | null;
  onOpenColumnId: number | null;
  linkbackComments?: boolean;
  // Every repository that has delivered, newest first, capped at REPOSITORIES_CAP.
  // Written only by recordGitEvent.
  repositories?: GitRepository[];
  // Ring buffer of the last processed delivery ids (newest last, capped at
  // RECENT_DELIVERIES_CAP). Written only by claimGitDelivery.
  recentDeliveries?: string[];
}

export interface GitRepository {
  repo: string;
  provider: string;
  lastEventAt: string;
}

export interface GitSettings {
  enabled: boolean;
  webhookId: string;
  secret: string;
  onMergeColumnId: number | null;
  onOpenColumnId: number | null;
  linkbackComments: boolean;
  repositories: GitRepository[];
}

function toDto(stored: StoredGitSettings): GitSettings {
  const { recentDeliveries: _internal, ...rest } = stored;
  return {
    ...rest,
    linkbackComments: stored.linkbackComments ?? true,
    secret: decryptSecret(stored.secret),
    repositories: stored.repositories ?? [],
  };
}

// Reads the project's settings, creating a disabled config with a fresh
// webhook id and secret on first read — the settings page needs both to show
// before the user has saved anything.
export async function getOrCreateGitSettings(projectId: number): Promise<GitSettings> {
  const stored = await getProjectSetting<StoredGitSettings>(projectId, GIT_SETTING_KEY);
  if (stored) return toDto(stored);
  const fresh: StoredGitSettings = {
    enabled: false,
    webhookId: randomBytes(16).toString('hex'),
    secret: encryptSecret(newSecret()),
    onMergeColumnId: null,
    onOpenColumnId: null,
    linkbackComments: true,
    repositories: [],
  };
  // Concurrent first reads race to insert; the loser keeps the winner's row so
  // both callers return the credentials that are actually stored.
  await db
    .insert(projectSetting)
    .values({ projectId, key: GIT_SETTING_KEY, value: fresh })
    .onConflictDoNothing();
  const winner = await getProjectSetting<StoredGitSettings>(projectId, GIT_SETTING_KEY);
  return toDto(winner ?? fresh);
}

// Merges the given fields into the stored jsonb in one UPDATE, so concurrent
// writers (a settings edit, a secret rotation, a delivery stamping telemetry)
// can never clobber each other's fields with a stale read.
async function mergeGitSettings(
  projectId: number,
  fields: Partial<StoredGitSettings>,
): Promise<void> {
  await db
    .update(projectSetting)
    .set({
      value: sql`${projectSetting.value} || ${JSON.stringify(fields)}::jsonb`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(projectSetting.projectId, projectId), eq(projectSetting.key, GIT_SETTING_KEY)));
}

export async function updateGitSettings(
  projectId: number,
  patch: {
    enabled?: boolean;
    onMergeColumnId?: number | null;
    onOpenColumnId?: number | null;
    linkbackComments?: boolean;
  },
): Promise<GitSettings> {
  await assertProjectColumn(projectId, patch.onMergeColumnId);
  await assertProjectColumn(projectId, patch.onOpenColumnId);
  await getOrCreateGitSettings(projectId);
  const fields: Partial<StoredGitSettings> = {};
  if (patch.enabled !== undefined) fields.enabled = patch.enabled;
  if (patch.onMergeColumnId !== undefined) fields.onMergeColumnId = patch.onMergeColumnId;
  if (patch.onOpenColumnId !== undefined) fields.onOpenColumnId = patch.onOpenColumnId;
  if (patch.linkbackComments !== undefined) fields.linkbackComments = patch.linkbackComments;
  if (Object.keys(fields).length > 0) await mergeGitSettings(projectId, fields);
  return getOrCreateGitSettings(projectId);
}

export async function regenerateGitSecret(projectId: number): Promise<GitSettings> {
  await getOrCreateGitSettings(projectId);
  await mergeGitSettings(projectId, { secret: encryptSecret(newSecret()) });
  return getOrCreateGitSettings(projectId);
}

// Resolves an incoming delivery's webhook id to its project. The id is stored
// inside the jsonb value, so this scans the 'git' settings rows by expression.
export async function findProjectByGitWebhookId(
  webhookId: string,
): Promise<{ projectId: number; settings: GitSettings } | null> {
  const rows = await db
    .select({ projectId: projectSetting.projectId, value: projectSetting.value })
    .from(projectSetting)
    .where(
      and(
        eq(projectSetting.key, GIT_SETTING_KEY),
        sql`${projectSetting.value}->>'webhookId' = ${webhookId}`,
      ),
    );
  if (!rows[0]) return null;
  return { projectId: rows[0].projectId, settings: toDto(rows[0].value as StoredGitSettings) };
}

// How many processed delivery ids the ring buffer keeps. Provider retries and
// manual redeliveries arrive close to the original, so a small window is
// enough; a replay also requires the project's secret.
const RECENT_DELIVERIES_CAP = 50;

// Claims a delivery id for processing by appending it to the recentDeliveries
// ring buffer. Returns false when the id is already in the buffer (a replay or a
// redelivery), in which case the caller must not act on it again. Check and
// append are one UPDATE, so two concurrent claims of the same id cannot both
// win.
export async function claimGitDelivery(projectId: number, deliveryId: string): Promise<boolean> {
  const recent = sql`COALESCE(${projectSetting.value}->'recentDeliveries', '[]'::jsonb)`;
  const claimed = await db
    .update(projectSetting)
    .set({
      value: sql`jsonb_set(${projectSetting.value}, '{recentDeliveries}', (
        SELECT COALESCE(jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
        FROM (
          SELECT elem, ord
          FROM jsonb_array_elements(${recent} || to_jsonb(${deliveryId}::text)) WITH ORDINALITY AS t(elem, ord)
          ORDER BY ord DESC
          LIMIT ${RECENT_DELIVERIES_CAP}
        ) latest
      ))`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(projectSetting.projectId, projectId),
        eq(projectSetting.key, GIT_SETTING_KEY),
        sql`NOT (${recent} ? ${deliveryId}::text)`,
      ),
    )
    .returning({ projectId: projectSetting.projectId });
  return claimed.length > 0;
}

// How many repositories the list keeps. A project delivering from more than this
// many is unusual; the oldest fall off the end.
const REPOSITORIES_CAP = 20;

// Moves the delivery's repository to the front of the list, with the time it
// arrived. Touches only that list, so a delivery can never revert a concurrent
// settings edit, and the list is rebuilt in the same UPDATE that reads it, so two
// deliveries at once cannot lose one another's entry.
export async function recordGitEvent(
  projectId: number,
  repo: string,
  provider: string,
): Promise<void> {
  const entry = JSON.stringify({ repo, provider, lastEventAt: new Date().toISOString() });
  const known = sql`COALESCE(${projectSetting.value}->'repositories', '[]'::jsonb)`;
  await db
    .update(projectSetting)
    .set({
      value: sql`jsonb_set(${projectSetting.value}, '{repositories}', (
        SELECT COALESCE(jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
        FROM (
          SELECT elem, ord
          FROM jsonb_array_elements(jsonb_build_array(${entry}::jsonb) || ${known}) WITH ORDINALITY AS t(elem, ord)
          WHERE ord = 1 OR elem->>'repo' <> ${repo} OR elem->>'provider' <> ${provider}
          ORDER BY ord
          LIMIT ${REPOSITORIES_CAP}
        ) kept
      ))`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(projectSetting.projectId, projectId), eq(projectSetting.key, GIT_SETTING_KEY)));
}

async function assertProjectColumn(
  projectId: number,
  columnId: number | null | undefined,
): Promise<void> {
  if (columnId == null) return;
  const rows = await db
    .select({ id: projectColumn.id })
    .from(projectColumn)
    .where(and(eq(projectColumn.id, columnId), eq(projectColumn.projectId, projectId)));
  if (!rows[0]) throw new HttpError(400, 'Unknown column');
}

// The project's first completed-type column — the default close target.
export async function firstCompletedColumnId(projectId: number): Promise<number | null> {
  const rows = await db
    .select({ id: projectColumn.id })
    .from(projectColumn)
    .where(and(eq(projectColumn.projectId, projectId), eq(projectColumn.stateType, 'completed')))
    .orderBy(asc(projectColumn.position))
    .limit(1);
  return rows[0]?.id ?? null;
}

// The stateType of each existing column among the given ids. A deleted column is
// simply absent, which is how callers detect a stale configured target.
export async function columnStateTypes(columnIds: number[]): Promise<Map<number, string>> {
  const ids = [...new Set(columnIds)];
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: projectColumn.id, stateType: projectColumn.stateType })
    .from(projectColumn)
    .where(inArray(projectColumn.id, ids));
  return new Map(rows.map((r) => [r.id, r.stateType]));
}
