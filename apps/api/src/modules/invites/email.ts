import { randomUUID } from 'node:crypto';
import { db, notificationDelivery, getInstanceEmailConfig, team } from '@repo/db';
import { composeEmail, savedLocaleOf, trustedOrigins } from '@repo/auth';
import {
  DEFAULT_LOCALE,
  emailWords,
  hasEmailProvider,
  sendEmail,
  type EmailWords,
  type Locale,
} from '@repo/mailer';
import { and, eq, sql } from 'drizzle-orm';
import type { InviteRow } from './service';

interface InviteProject {
  id: number;
  name: string;
}

async function inviteLocale(invite: InviteRow): Promise<Locale> {
  const invited = await savedLocaleOf(invite.email);
  if (invited) return invited;
  const sender = invite.invitedByEmail ? await savedLocaleOf(invite.invitedByEmail) : null;
  return sender ?? DEFAULT_LOCALE;
}

function inviterName(invite: InviteRow, words: EmailWords): string {
  return invite.invitedByName ?? invite.invitedByEmail ?? words.someone;
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
  const locale = await inviteLocale(invite);
  const words = emailWords(locale);
  const url = new URL(`/invite/${invite.token}`, trustedOrigins[0]).toString();
  const email = await composeEmail(
    'inviteProject',
    locale,
    {
      inviter: inviterName(invite, words),
      project: project.name,
      role: invite.role === 'owner' ? words.owner : (invite.roleName ?? words.member),
    },
    url,
  );

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
        ...email,
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
  const locale = await inviteLocale(invite);
  const words = emailWords(locale);
  const email = await composeEmail(
    'inviteTeam',
    locale,
    {
      inviter: inviterName(invite, words),
      team: row?.name ?? words.untitled,
      role: words[invite.teamRole],
    },
    `${trustedOrigins[0]}/invite/${invite.token}`,
  );
  const result = await sendEmail(config, { to: invite.email, ...email });
  if (!result.ok) console.error('[invites] team invite email failed:', result.error);
  return result.ok;
}
