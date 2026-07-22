import { db, projectSetting } from '@repo/db';
import { and, eq, sql } from 'drizzle-orm';

// Instance settings (app_setting) are read through getSetting/setSetting in
// @repo/db, because @repo/auth reads them too.

// Per-project settings (project_setting): the same key-value store scoped to a
// project. Typed accessors per key live in the feature that owns the key (e.g.
// auto-archive in projects/store.ts).

export async function getProjectSetting<T>(projectId: number, key: string): Promise<T | null> {
  const rows = await db
    .select({ value: projectSetting.value })
    .from(projectSetting)
    .where(and(eq(projectSetting.projectId, projectId), eq(projectSetting.key, key)));
  return rows[0] ? (rows[0].value as T) : null;
}

export async function setProjectSetting(
  projectId: number,
  key: string,
  value: unknown,
): Promise<void> {
  await db
    .insert(projectSetting)
    .values({ projectId, key, value })
    .onConflictDoUpdate({
      target: [projectSetting.projectId, projectSetting.key],
      set: { value, updatedAt: sql`now()` },
    });
}
