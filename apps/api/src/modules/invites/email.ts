import { randomUUID } from 'node:crypto';
import { db, notificationDelivery, getInstanceEmailConfig, team } from '@repo/db';
import { trustedOrigins } from '@repo/auth';
import { emailBody, hasEmailProvider, sendEmail } from '@repo/mailer';
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
  const config = await getInstanceEmailConfig();
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

// A team invite names no project, and the notification outbox belongs to one, so it
// cannot be queued there. It is sent at once instead, as the sign-in emails are:
// best effort, without the outbox's retries. A failure leaves the link to be copied.
export async function sendTeamInviteEmail(teamId: number, invite: InviteRow): Promise<boolean> {
  const config = await getInstanceEmailConfig();
  if (!config || !hasEmailProvider(config)) return false;

  const [row] = await db.select({ name: team.name }).from(team).where(eq(team.id, teamId));
  const teamName = (row?.name ?? 'a team').replace(/[\r\n]+/g, ' ');
  const inviter = invite.invitedByName ?? invite.invitedByEmail ?? "An It's a Plan user";
  const { text, html } = emailBody(
    `${inviter} invited you to join the team ${teamName} as ${invite.teamRole}.\n\n` +
      'Open the invitation to sign in or create an account. ' +
      'If you did not expect this invitation, you can ignore this email.',
    `${trustedOrigins[0]}/invite/${invite.token}`,
  );
  const result = await sendEmail(config, {
    to: invite.email,
    subject: `You were invited to ${teamName} on It's a Plan`,
    text,
    html,
  });
  if (!result.ok) console.error('[invites] team invite email failed:', result.error);
  return result.ok;
}
