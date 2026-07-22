import { db, integrationCredential } from '@repo/db';
import { and, eq } from 'drizzle-orm';
import {
  coerceConfig,
  redactConfig,
  ToolConfigError,
  type ToolConfig,
  type ConfigField,
} from '@repo/agent-tools';
import { iso, HttpError } from '../shared/lib';
import { encryptSecret, decryptSecret } from '@repo/crypto';
import { credentialSchemaFor } from './catalog';

// Data access for integration credentials. The full credential object is encrypted at
// rest (AES-256-GCM) as one JSON blob; `redacted` holds the same object with secret
// fields masked, in plaintext, for a masked display. The plaintext credential is only
// read by the runtime through getCredentialSecret, never returned over HTTP.

export interface CredentialRow {
  id: number;
  projectId: number;
  integrationKey: string;
  label: string | null;
  redacted: Record<string, unknown>;
  createdAt: string;
}

const dtoColumns = {
  id: integrationCredential.id,
  projectId: integrationCredential.projectId,
  integrationKey: integrationCredential.integrationKey,
  label: integrationCredential.label,
  redacted: integrationCredential.redacted,
  createdAt: integrationCredential.createdAt,
};

function mapRow(row: {
  id: number;
  projectId: number;
  integrationKey: string;
  label: string | null;
  redacted: unknown;
  createdAt: Date;
}): CredentialRow {
  return {
    id: row.id,
    projectId: row.projectId,
    integrationKey: row.integrationKey,
    label: row.label,
    redacted:
      row.redacted && typeof row.redacted === 'object'
        ? (row.redacted as Record<string, unknown>)
        : {},
    createdAt: iso(row.createdAt),
  };
}

// Validates a submitted credential against a schema, mapping the package's validation
// error to a 400.
function coerce(fields: ConfigField[], input: unknown): ToolConfig {
  try {
    return coerceConfig(fields, input);
  } catch (err) {
    if (err instanceof ToolConfigError) throw new HttpError(400, err.message);
    throw err;
  }
}

export async function listCredentials(projectId: number): Promise<CredentialRow[]> {
  const rows = await db
    .select(dtoColumns)
    .from(integrationCredential)
    .where(eq(integrationCredential.projectId, projectId))
    .orderBy(integrationCredential.integrationKey);
  return rows.map(mapRow);
}

export async function getCredentialById(
  id: number,
  projectId: number,
): Promise<CredentialRow | null> {
  const rows = await db
    .select(dtoColumns)
    .from(integrationCredential)
    .where(and(eq(integrationCredential.id, id), eq(integrationCredential.projectId, projectId)));
  return rows[0] ? mapRow(rows[0]) : null;
}

async function decrypt(id: number, projectId: number): Promise<ToolConfig | null> {
  const rows = await db
    .select({
      ciphertext: integrationCredential.ciphertext,
      iv: integrationCredential.iv,
      authTag: integrationCredential.authTag,
    })
    .from(integrationCredential)
    .where(and(eq(integrationCredential.id, id), eq(integrationCredential.projectId, projectId)));
  const row = rows[0];
  if (!row) return null;
  return JSON.parse(decryptSecret(row)) as ToolConfig;
}

export interface NewCredentialInput {
  integrationKey: string;
  label?: string | null;
  credential: Record<string, unknown>;
}

export async function createCredential(
  projectId: number,
  input: NewCredentialInput,
): Promise<CredentialRow> {
  const schema = credentialSchemaFor(input.integrationKey);
  if (!schema) throw new HttpError(400, `Unknown integration: ${input.integrationKey}`);
  const config = coerce(schema, input.credential);
  const enc = encryptSecret(JSON.stringify(config));
  const [row] = await db
    .insert(integrationCredential)
    .values({
      projectId,
      integrationKey: input.integrationKey,
      label: input.label ?? null,
      ciphertext: enc.ciphertext,
      iv: enc.iv,
      authTag: enc.authTag,
      redacted: redactConfig(schema, config),
    })
    .returning(dtoColumns);
  return mapRow(row);
}

export interface CredentialPatch {
  label?: string | null;
  // Only the fields being changed. Secret fields left out keep their stored value.
  credential?: Record<string, unknown>;
}

export async function updateCredential(
  id: number,
  projectId: number,
  patch: CredentialPatch,
): Promise<CredentialRow | null> {
  const existing = await getCredentialById(id, projectId);
  if (!existing) return null;
  const schema = credentialSchemaFor(existing.integrationKey);
  if (!schema) throw new HttpError(400, `Unknown integration: ${existing.integrationKey}`);

  const set: Partial<typeof integrationCredential.$inferInsert> = {};
  if (patch.label !== undefined) set.label = patch.label;

  if (patch.credential !== undefined) {
    // Merge the submitted fields over the stored credential so unchanged secrets (left
    // out by the form) are preserved, then re-validate the whole credential.
    const current = (await decrypt(id, projectId)) ?? {};
    const merged = coerce(schema, { ...current, ...patch.credential });
    const enc = encryptSecret(JSON.stringify(merged));
    set.ciphertext = enc.ciphertext;
    set.iv = enc.iv;
    set.authTag = enc.authTag;
    set.redacted = redactConfig(schema, merged);
  }

  if (Object.keys(set).length > 0) {
    await db
      .update(integrationCredential)
      .set(set)
      .where(and(eq(integrationCredential.id, id), eq(integrationCredential.projectId, projectId)));
  }
  return getCredentialById(id, projectId);
}

export async function deleteCredential(id: number, projectId: number): Promise<boolean> {
  const existing = await getCredentialById(id, projectId);
  if (!existing) return false;
  await db
    .delete(integrationCredential)
    .where(and(eq(integrationCredential.id, id), eq(integrationCredential.projectId, projectId)));
  return true;
}

// The decrypted credential for the runtime: its integration key and config. Not
// exposed over HTTP. Returns null when the credential does not exist in the project.
export async function getCredentialSecret(
  id: number,
  projectId: number,
): Promise<{ integrationKey: string; config: ToolConfig } | null> {
  const existing = await getCredentialById(id, projectId);
  if (!existing) return null;
  const config = (await decrypt(id, projectId)) ?? {};
  return { integrationKey: existing.integrationKey, config };
}
