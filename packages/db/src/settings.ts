import { eq, sql } from 'drizzle-orm';
import { db } from './client';
import { appSetting } from './schema/app';

// Data access for global instance settings (app_setting): a key-value store, not
// scoped to a project. The value is a jsonb blob owned by the reading feature, so
// one table backs many settings. It lives here rather than in the api because both
// the api (god mode routes) and @repo/auth (the registration gate) read it.

export async function getSetting<T>(key: string): Promise<T | null> {
  const rows = await db
    .select({ value: appSetting.value })
    .from(appSetting)
    .where(eq(appSetting.key, key));
  return rows[0] ? (rows[0].value as T) : null;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db
    .insert(appSetting)
    .values({ key, value })
    .onConflictDoUpdate({
      target: appSetting.key,
      set: { value, updatedAt: sql`now()` },
    });
}
