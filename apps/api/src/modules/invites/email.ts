import { randomUUID } from 'node:crypto';
import { db, notificationDelivery } from '@repo/db';
import { getEmailConfig, trustedOrigins } from '@repo/auth';
import { hasEmailProvider } from '@repo/mailer';
import { and, eq, sql } from 'drizzle-orm';
import type { InviteRow } from './service';

interface InviteProject {
  id: number;
  name: string;
}

// Serializes enqueue attempts for one invite across API replicas. Without this,
// two clicks arriving together can both observe an empty outbox and insert the
// same email before either transaction commits.
const INVITE_EMAIL_LOCK_NAMESPACE = 8242;

export async function enqueueInviteEmail(
  project: InviteProject,
  invite: InviteRow,
): Promise<boolean> {
  const config = await getEmailConfig();
  if (!config || !hasEmailProvider(config)) return false;

  const dedupeKey = `project-invite:${invite.id}`;
  const inviter = invite.invitedByName ?? invite.invitedByEmail ?? "An It's a Plan user";
  const role = invite.role === 'owner' ? 'owner' : (invite.roleName ?? 'member');
  const projectName = project.name.replace(/[\r\n]+/g, ' ');
  const url = new URL(`/invite/${invite.token}`, trustedOrigins[0]).toString();

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${INVITE_EMAIL_LOCK_NAMESPACE}, ${invite.id})`,
    );
    const [pending] = await tx
      .select({ id: notificationDelivery.id })
      .from(notificationDelivery)
      .where(
        and(
          eq(notificationDelivery.projectId, project.id),
          eq(notificationDelivery.channel, 'email'),
          eq(notificationDelivery.recipient, invite.email),
          eq(notificationDelivery.status, 'pending'),
          sql`${notificationDelivery.payload}->>'dedupeKey' = ${dedupeKey}`,
        ),
      )
      .limit(1);
    if (pending) return;

    await tx.insert(notificationDelivery).values({
      projectId: project.id,
      channel: 'email',
      recipient: invite.email,
      payload: {
        subject: `You were invited to ${projectName} on It's a Plan`,
        text:
          `${inviter} invited you to join ${projectName} as ${role}.\n\n` +
          'Open the invitation to sign in or create an account. ' +
          'If you did not expect this invitation, you can ignore this email.',
        url,
        emailSource: 'instance',
        idempotencyKey: `project-invite/${invite.id}/${randomUUID()}`,
        dedupeKey,
        projectInviteId: invite.id,
      },
    });
  });
  return true;
}
