import { db, agentTool, agentToolLink, integrationCredential } from '@repo/db';
import { and, eq, inArray } from 'drizzle-orm';
import { getTool, type ToolConfig } from '@repo/agent-tools';
import { iso, HttpError, rethrowDuplicate } from '../shared/lib';
import { decryptSecret } from '@repo/crypto';
import { getCredentialById } from '../integrations/store';

// Data access for configured tools. A configured tool binds a catalog tool (tool_key)
// to one integration_credential. The secret lives on the credential, so a row here
// carries no secret; the runtime decrypts the bound credential at call time. The list
// DTO enriches a row with its credential's integration and label for display.

export interface AgentToolRow {
  id: number;
  projectId: number;
  toolKey: string;
  credentialId: number;
  integrationKey: string;
  credentialLabel: string | null;
  createdAt: string;
}

const dtoColumns = {
  id: agentTool.id,
  projectId: agentTool.projectId,
  toolKey: agentTool.toolKey,
  credentialId: agentTool.credentialId,
  integrationKey: integrationCredential.integrationKey,
  credentialLabel: integrationCredential.label,
  createdAt: agentTool.createdAt,
};

function mapRow(row: Omit<AgentToolRow, 'createdAt'> & { createdAt: Date }): AgentToolRow {
  return { ...row, createdAt: iso(row.createdAt) };
}

export async function listAgentTools(projectId: number): Promise<AgentToolRow[]> {
  const rows = await db
    .select(dtoColumns)
    .from(agentTool)
    .innerJoin(integrationCredential, eq(integrationCredential.id, agentTool.credentialId))
    .where(eq(agentTool.projectId, projectId))
    .orderBy(agentTool.toolKey);
  return rows.map(mapRow);
}

async function getAgentToolById(id: number, projectId: number): Promise<AgentToolRow | null> {
  const rows = await db
    .select(dtoColumns)
    .from(agentTool)
    .innerJoin(integrationCredential, eq(integrationCredential.id, agentTool.credentialId))
    .where(and(eq(agentTool.id, id), eq(agentTool.projectId, projectId)));
  return rows[0] ? mapRow(rows[0]) : null;
}

export interface NewAgentToolInput {
  toolKey: string;
  credentialId: number;
}

export async function createAgentTool(
  projectId: number,
  input: NewAgentToolInput,
): Promise<AgentToolRow> {
  const found = getTool(input.toolKey);
  if (!found) throw new HttpError(400, `Unknown tool: ${input.toolKey}`);
  const credential = await getCredentialById(input.credentialId, projectId);
  if (!credential) throw new HttpError(400, 'Credential not found');
  // The bound credential must belong to the tool's integration.
  if (credential.integrationKey !== found.integration.key) {
    throw new HttpError(
      400,
      `This tool needs a ${found.integration.label} credential, not ${credential.integrationKey}.`,
    );
  }
  try {
    const [row] = await db
      .insert(agentTool)
      .values({ projectId, toolKey: input.toolKey, credentialId: input.credentialId })
      .returning({ id: agentTool.id });
    return (await getAgentToolById(row.id, projectId))!;
  } catch (err) {
    rethrowDuplicate(err, 'This tool on this credential');
    throw err;
  }
}

export async function deleteAgentTool(id: number, projectId: number): Promise<boolean> {
  const deleted = await db
    .delete(agentTool)
    .where(and(eq(agentTool.id, id), eq(agentTool.projectId, projectId)))
    .returning({ id: agentTool.id });
  return deleted.length > 0;
}

// The configured tools enabled on an agent, as DTOs (no secret). Used by the agent
// editor.
export async function listAgentToolLinks(agentId: number): Promise<AgentToolRow[]> {
  const rows = await db
    .select(dtoColumns)
    .from(agentToolLink)
    .innerJoin(agentTool, eq(agentTool.id, agentToolLink.agentToolId))
    .innerJoin(integrationCredential, eq(integrationCredential.id, agentTool.credentialId))
    .where(eq(agentToolLink.agentId, agentId))
    .orderBy(agentTool.toolKey);
  return rows.map(mapRow);
}

// The decrypted tools enabled on an agent, for the runtime to build tools: each tool's
// key and its bound credential. Not exposed over HTTP.
export async function listAgentToolsForRun(
  agentId: number,
): Promise<{ id: number; toolKey: string; credential: ToolConfig }[]> {
  const rows = await db
    .select({
      id: agentTool.id,
      toolKey: agentTool.toolKey,
      ciphertext: integrationCredential.ciphertext,
      iv: integrationCredential.iv,
      authTag: integrationCredential.authTag,
    })
    .from(agentToolLink)
    .innerJoin(agentTool, eq(agentTool.id, agentToolLink.agentToolId))
    .innerJoin(integrationCredential, eq(integrationCredential.id, agentTool.credentialId))
    .where(eq(agentToolLink.agentId, agentId));
  return rows.map((r) => ({
    id: r.id,
    toolKey: r.toolKey,
    credential: JSON.parse(
      decryptSecret({ ciphertext: r.ciphertext, iv: r.iv, authTag: r.authTag }),
    ) as ToolConfig,
  }));
}

// Replaces the set of configured tools enabled on an agent. Only tools in the agent's
// project are accepted; unknown or cross-project ids are ignored.
export async function setAgentTools(
  agentId: number,
  projectId: number,
  agentToolIds: number[],
): Promise<void> {
  const unique = [...new Set(agentToolIds)];
  const valid =
    unique.length === 0
      ? []
      : (
          await db
            .select({ id: agentTool.id })
            .from(agentTool)
            .where(and(eq(agentTool.projectId, projectId), inArray(agentTool.id, unique)))
        ).map((r) => r.id);

  await db.transaction(async (tx) => {
    await tx.delete(agentToolLink).where(eq(agentToolLink.agentId, agentId));
    if (valid.length > 0) {
      await tx.insert(agentToolLink).values(valid.map((agentToolId) => ({ agentId, agentToolId })));
    }
  });
}
