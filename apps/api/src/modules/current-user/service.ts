import { eq } from 'drizzle-orm';
import { aiAgent, db, user, userPreference } from '@repo/db';
import { iso } from '#shared/lib';
import type { SessionUser } from '#shared/auth-context';
import { DEFAULT_TIMEZONE } from '#modules/user-preferences/service';

export async function getCurrentUser(account: SessionUser) {
  const [row] = await db
    .select({
      agentId: aiAgent.id,
      agentUsername: aiAgent.username,
      timezone: userPreference.timezone,
    })
    .from(user)
    .leftJoin(aiAgent, eq(aiAgent.userId, user.id))
    .leftJoin(userPreference, eq(userPreference.userId, user.id))
    .where(eq(user.id, account.id))
    .limit(1);
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    emailVerified: account.emailVerified,
    image: account.image ?? null,
    createdAt: iso(account.createdAt),
    updatedAt: iso(account.updatedAt),
    username: account.username ?? row?.agentUsername ?? null,
    displayUsername: account.displayUsername ?? null,
    role: account.role ?? null,
    active: account.active ?? null,
    timezone: row?.timezone ?? DEFAULT_TIMEZONE,
    isAgent: Boolean(row?.agentId),
  };
}
