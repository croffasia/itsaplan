import { randomUUID } from 'node:crypto';
import { db, notificationDelivery, teamInvite } from '@repo/db';
import { getEmailConfig, trustedOrigins } from '@repo/auth';
import { hasEmailProvider } from '@repo/mailer';
import { and, eq, sql } from 'drizzle-orm';
import { HttpError } from '#shared/lib';
import type { InviteRow } from './service';
import { inviteThrottle } from './throttle';

interface InviteProject {
  id: number;
  name: string;
}

// Serializes enqueue attempts for one invite across API replicas. Without this,
// two clicks arriving together can both observe an empty outbox and insert the
// same email before either transaction commits.
const INVITE_EMAIL_LOCK_NAMESPACE = 8242;

// The subject is fixed: the email leaves from the instance's own domain, and a project
// name is free text its owner controls. The name appears in the body, attributed to
// the sender and quoted, and the mailer escapes it in the HTML part.
export const INVITE_EMAIL_SUBJECT = "You have been invited to It's a Plan";

export function inviteEmailPayload(
  project: InviteProject,
  invite: Pick<
    InviteRow,
    'id' | 'token' | 'role' | 'roleName' | 'invitedByName' | 'invitedByEmail'
  >,
) {
  const dedupeKey = `project-invite:${invite.id}`;
  const inviter = invite.invitedByName ?? invite.invitedByEmail ?? "An It's a Plan user";
  const role = invite.role === 'owner' ? 'owner' : (invite.roleName ?? 'member');
  const projectName = project.name.replace(/[\r\n]+/g, ' ');
  const url = new URL(`/invite/${invite.token}`, trustedOrigins[0]).toString();
  return {
    subject: INVITE_EMAIL_SUBJECT,
    text:
      `${inviter} invited you to join the project "${projectName}" as ${role}.\n\n` +
      'Open the invitation to sign in or create an account. ' +
      'If you did not expect this invitation, you can ignore this email.',
    url,
    emailSource: 'instance' as const,
    idempotencyKey: `project-invite/${invite.id}/${randomUUID()}`,
    dedupeKey,
    projectInviteId: invite.id,
  };
}

export async function enqueueInviteEmail(
  project: InviteProject,
  invite: InviteRow,
): Promise<boolean> {
  const config = await getEmailConfig();
  if (!config || !hasEmailProvider(config)) return false;

  const payload = inviteEmailPayload(project, invite);
  const { emailCooldownMs } = inviteThrottle();

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${INVITE_EMAIL_LOCK_NAMESPACE}, ${invite.id})`,
    );
    const [row] = await tx
      .select({ emailQueuedAt: teamInvite.emailQueuedAt })
      .from(teamInvite)
      .where(eq(teamInvite.id, invite.id));
    const queuedAt = row?.emailQueuedAt?.getTime() ?? 0;
    const waitMs = queuedAt + emailCooldownMs - Date.now();
    if (waitMs > 0) {
      const minutes = Math.max(1, Math.ceil(waitMs / 60_000));
      throw new HttpError(
        429,
        `This invite email was sent recently. Try again in ${minutes} min.`,
        'INVITE_EMAIL_COOLDOWN',
      );
    }

    const [pending] = await tx
      .select({ id: notificationDelivery.id })
      .from(notificationDelivery)
      .where(
        and(
          eq(notificationDelivery.projectId, project.id),
          eq(notificationDelivery.channel, 'email'),
          eq(notificationDelivery.recipient, invite.email),
          eq(notificationDelivery.status, 'pending'),
          sql`${notificationDelivery.payload}->>'dedupeKey' = ${payload.dedupeKey}`,
        ),
      )
      .limit(1);
    if (pending) return;

    await tx.insert(notificationDelivery).values({
      projectId: project.id,
      channel: 'email',
      recipient: invite.email,
      payload,
    });
    await tx
      .update(teamInvite)
      .set({ emailQueuedAt: new Date() })
      .where(eq(teamInvite.id, invite.id));
  });
  return true;
}
