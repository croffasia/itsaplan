import { db, appSetting, userPreference } from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import type { AuthUser } from '#shared/access';
import { getAppVersion, releasesSince, type Release } from './updates';

// The screen shown once after an upgrade: what the release brought, where the
// database dump taken before its migrations is, and what the migrations did to this
// instance's data.
//
// The dump and the data report are administration: they name the projects, roles and
// agents of the whole instance, so only its owner reads them. Team ownership is not
// the line to draw here — every account is given a team of its own at registration,
// which would make that everyone.

const MIGRATION_REPORT_KEY = 'migration.teams';
// The migration is matched by name, not by its number: a merge from main renumbers the
// file, and a number here would stop matching the tag the run recorded.
const MIGRATION_TAG_SUFFIX = '_teams';
// What the last upgrade applied, written by migrate.ts on startup.
const MIGRATION_RUN_KEY = 'migration.last';
const BACKUP_KEY = 'backup.last';

export interface BackupInfo {
  path: string;
  sizeBytes: number;
  createdAt: string;
  expiresAt: string;
  migrations: string[];
}

export interface TeamsMigrationReport {
  version: number;
  teams: { name: string; projects: { key: string; name: string }[] }[];
  renamed: Record<string, { from: string; to: string }[]>;
  merged: { roles: number; agentTools: number };
  movedInvites: number;
  droppedNotificationSettings: string[];
}

export interface WhatsNew {
  version: string;
  // False once the user closes the screen for this version.
  pending: boolean;
  // Every release this user has not seen yet, newest first.
  releases: Release[];
  backup: BackupInfo | null;
  migration: TeamsMigrationReport | null;
}

async function readSetting<T>(key: string): Promise<T | null> {
  const [row] = await db
    .select({ value: appSetting.value })
    .from(appSetting)
    .where(eq(appSetting.key, key));
  return row ? (row.value as T) : null;
}

export async function getWhatsNew(user: AuthUser): Promise<WhatsNew> {
  const version = getAppVersion();
  const [preference] = await db
    .select({ seenVersion: userPreference.seenVersion })
    .from(userPreference)
    .where(eq(userPreference.userId, user.id));
  const admin = user.role === 'god';
  const releases = await releasesSince(preference?.seenVersion ?? null);
  const [backup, applied] = admin
    ? await Promise.all([
        readSetting<BackupInfo>(BACKUP_KEY),
        readSetting<{ migrations: string[] }>(MIGRATION_RUN_KEY),
      ])
    : [null, null];
  // The report belongs to the upgrade that applied its migration. A later release,
  // and a fresh install where the migration ran over an empty database, leave it out:
  // the row it wrote stays for an operator reading app_setting by hand.
  const migration = applied?.migrations.some((tag) => tag.endsWith(MIGRATION_TAG_SUFFIX))
    ? await readSetting<TeamsMigrationReport>(MIGRATION_REPORT_KEY)
    : null;
  return {
    version,
    pending: preference?.seenVersion !== version,
    releases,
    backup,
    migration,
  };
}

// Closes the screen for this user, for the version they saw. A row is written even
// when they have no preferences yet, so the screen does not come back.
export async function markWhatsNewSeen(userId: string): Promise<void> {
  await db
    .insert(userPreference)
    .values({ userId, seenVersion: getAppVersion() })
    .onConflictDoUpdate({
      target: userPreference.userId,
      set: { seenVersion: getAppVersion(), updatedAt: sql`now()` },
    });
}
