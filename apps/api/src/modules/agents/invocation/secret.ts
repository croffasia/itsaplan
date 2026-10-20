import { db, aiAgent } from '@repo/db';
import { and, eq, isNull } from 'drizzle-orm';
import { decryptSecret, encryptSecret } from '@repo/crypto';
import { generateSecret } from '#modules/webhooks/service';

// The key an external agent's invocations are signed with. It is issued with the
// agent's first invocation URL and read back to sign every request, so it is kept
// encrypted rather than hashed.

function encryptedColumns(secret: string) {
  const enc = encryptSecret(secret);
  return {
    invocationSecretCiphertext: enc.ciphertext,
    invocationSecretIv: enc.iv,
    invocationSecretAuthTag: enc.authTag,
  };
}

// Issues a secret for an agent that has none and leaves one already issued as it is, so
// saving the URL again does not break the receiver that verifies with it.
export async function ensureInvocationSecret(agentId: number): Promise<void> {
  await db
    .update(aiAgent)
    .set(encryptedColumns(generateSecret()))
    .where(and(eq(aiAgent.id, agentId), isNull(aiAgent.invocationSecretCiphertext)));
}

// Replaces the secret and returns the new one. Requests signed before take the old one,
// so the receiver has to be given the new value before the next request arrives.
export async function rotateInvocationSecret(agentId: number): Promise<string> {
  const secret = generateSecret();
  await db.update(aiAgent).set(encryptedColumns(secret)).where(eq(aiAgent.id, agentId));
  return secret;
}

export async function readInvocationSecret(agentId: number): Promise<string | null> {
  const rows = await db
    .select({
      ciphertext: aiAgent.invocationSecretCiphertext,
      iv: aiAgent.invocationSecretIv,
      authTag: aiAgent.invocationSecretAuthTag,
    })
    .from(aiAgent)
    .where(eq(aiAgent.id, agentId));
  const row = rows[0];
  if (!row?.ciphertext || !row.iv || !row.authTag) return null;
  return decryptSecret({ ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag });
}
