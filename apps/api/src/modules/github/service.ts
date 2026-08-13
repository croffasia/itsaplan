import { randomBytes } from 'node:crypto';
import { db, projectColumn, projectSetting } from '@repo/db';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { decryptSecret, encryptSecret, type EncryptedSecret } from '@repo/crypto';
import { HttpError } from '#shared/lib';
import { getProjectSetting } from '../../settings/store';

// Exported for the project copier, which must not clone this setting: the copy
// would carry the source's secret and webhook id (a credential disclosure to the
// copy's owner, and ambiguous inbound routing).
export const GITHUB_SETTING_KEY = 'github';

// The GitHub integration config for a project, stored in project_setting under
// GITHUB_SETTING_KEY. `webhookId` routes an incoming delivery to the project (it is the
// unguessable path segment of the payload URL); `secret` signs deliveries
// (X-Hub-Signature-256) and is encrypted at rest. `onMergeColumnId` is the column
// a closed issue moves to when a linked PR merges (null = the project's first
// completed column); `onOpenColumnId` is where an issue moves when a linked PR is
// opened (null = no action). lastEventAt/lastEventRepo show the settings page
// that deliveries arrive.
interface StoredGithubSettings {
  enabled: boolean;
  webhookId: string;
  secret: EncryptedSecret;
  onMergeColumnId: number | null;
  onOpenColumnId: number | null;
  lastEventAt: string | null;
  lastEventRepo: string | null;
  // Ring buffer of the last processed X-GitHub-Delivery GUIDs (newest last,
  // capped at RECENT_DELIVERIES_CAP). Written only by claimGithubDelivery.
  recentDeliveries?: string[];
}

export interface GithubSettings {
  enabled: boolean;
  webhookId: string;
  secret: string;
  onMergeColumnId: number | null;
  onOpenColumnId: number | null;
  lastEventAt: string | null;
  lastEventRepo: string | null;
}

function toDto(stored: StoredGithubSettings): GithubSettings {
  const { recentDeliveries: _internal, ...rest } = stored;
  return { ...rest, secret: decryptSecret(stored.secret) };
}

// Reads the project's GitHub settings, creating a disabled config with a fresh
// webhook id and secret on first read — the settings page needs both to show
// before the user has saved anything.
export async function getOrCreateGithubSettings(projectId: number): Promise<GithubSettings> {
  const stored = await getProjectSetting<StoredGithubSettings>(projectId, GITHUB_SETTING_KEY);
  if (stored) return toDto(stored);
  const fresh: StoredGithubSettings = {
    enabled: false,
    webhookId: randomBytes(16).toString('hex'),
    secret: encryptSecret(`ghs_${randomBytes(24).toString('hex')}`),
    onMergeColumnId: null,
    onOpenColumnId: null,
    lastEventAt: null,
    lastEventRepo: null,
  };
  // Concurrent first reads race to insert; the loser keeps the winner's row so
  // both callers return the credentials that are actually stored.
  await db
    .insert(projectSetting)
    .values({ projectId, key: GITHUB_SETTING_KEY, value: fresh })
    .onConflictDoNothing();
  const winner = await getProjectSetting<StoredGithubSettings>(projectId, GITHUB_SETTING_KEY);
  return toDto(winner ?? fresh);
}

// Merges the given fields into the stored jsonb in one UPDATE, so concurrent
// writers (a settings edit, a secret rotation, a delivery stamping telemetry)
// can never clobber each other's fields with a stale read.
async function mergeGithubSettings(
  projectId: number,
  fields: Partial<StoredGithubSettings>,
): Promise<void> {
  await db
    .update(projectSetting)
    .set({
      value: sql`${projectSetting.value} || ${JSON.stringify(fields)}::jsonb`,
      updatedAt: sql`now()`,
    })
    .where(
      and(eq(projectSetting.projectId, projectId), eq(projectSetting.key, GITHUB_SETTING_KEY)),
    );
}

export async function updateGithubSettings(
  projectId: number,
  patch: { enabled?: boolean; onMergeColumnId?: number | null; onOpenColumnId?: number | null },
): Promise<GithubSettings> {
  await assertProjectColumn(projectId, patch.onMergeColumnId);
  await assertProjectColumn(projectId, patch.onOpenColumnId);
  await getOrCreateGithubSettings(projectId);
  const fields: Partial<StoredGithubSettings> = {};
  if (patch.enabled !== undefined) fields.enabled = patch.enabled;
  if (patch.onMergeColumnId !== undefined) fields.onMergeColumnId = patch.onMergeColumnId;
  if (patch.onOpenColumnId !== undefined) fields.onOpenColumnId = patch.onOpenColumnId;
  if (Object.keys(fields).length > 0) await mergeGithubSettings(projectId, fields);
  return getOrCreateGithubSettings(projectId);
}

export async function regenerateGithubSecret(projectId: number): Promise<GithubSettings> {
  await getOrCreateGithubSettings(projectId);
  await mergeGithubSettings(projectId, {
    secret: encryptSecret(`ghs_${randomBytes(24).toString('hex')}`),
  });
  return getOrCreateGithubSettings(projectId);
}

// Resolves an incoming delivery's webhook id to its project. The id is stored
// inside the jsonb value, so this scans the 'github' settings rows by expression.
export async function findProjectByGithubWebhookId(
  webhookId: string,
): Promise<{ projectId: number; settings: GithubSettings } | null> {
  const rows = await db
    .select({ projectId: projectSetting.projectId, value: projectSetting.value })
    .from(projectSetting)
    .where(
      and(
        eq(projectSetting.key, GITHUB_SETTING_KEY),
        sql`${projectSetting.value}->>'webhookId' = ${webhookId}`,
      ),
    );
  if (!rows[0]) return null;
  return { projectId: rows[0].projectId, settings: toDto(rows[0].value as StoredGithubSettings) };
}

// How many processed delivery GUIDs the ring buffer keeps. GitHub retries and
// manual redeliveries arrive close to the original, so a small window is
// enough; a replay also requires a validly signed body.
const RECENT_DELIVERIES_CAP = 50;

// Claims an X-GitHub-Delivery GUID for processing by appending it to the
// recentDeliveries ring buffer. Returns false when the GUID is already in the
// buffer (a replay or a GitHub redelivery), in which case the caller must not
// act on it again. Check and append are one UPDATE, so two concurrent claims of
// the same GUID cannot both win.
export async function claimGithubDelivery(projectId: number, deliveryId: string): Promise<boolean> {
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
        eq(projectSetting.key, GITHUB_SETTING_KEY),
        sql`NOT (${recent} ? ${deliveryId}::text)`,
      ),
    )
    .returning({ projectId: projectSetting.projectId });
  return claimed.length > 0;
}

// Stamps the settings with the delivery that just arrived. Touches only the two
// telemetry fields, so a delivery can never revert a concurrent settings edit.
export async function recordGithubEvent(projectId: number, repo: string): Promise<void> {
  await mergeGithubSettings(projectId, {
    lastEventAt: new Date().toISOString(),
    lastEventRepo: repo,
  });
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
