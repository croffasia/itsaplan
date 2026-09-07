import { describe, it, expect, beforeEach } from 'bun:test';
import { setSetting } from '@repo/db';
import { authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// The screen shown once after an upgrade. The report, the backup and the record of
// what the upgrade applied are app_setting rows — written by the teams migration and
// by the api on startup — and resetDb truncates that table, so a test that wants them writes
// them itself. The report only reaches the screen when the last run applied its
// migration, which is what keeps it off a later release.

const REPORT = {
  version: 1,
  teams: [{ name: 'alice', projects: [{ key: 'WEB', name: 'Website' }] }],
  renamed: { roles: [{ from: 'QA', to: 'QA (Website)' }] },
  merged: { roles: 1, agentTools: 0 },
  movedInvites: 2,
  droppedNotificationSettings: ['Website'],
};

// The pair an upgrade that applied the teams migration leaves behind.
async function recordTeamsUpgrade() {
  await setSetting('migration.last', { migrations: ['0114_something', '0119_teams'] });
  await setSetting('migration.teams', REPORT);
}

async function signUpClient() {
  const user = await signUpTestUser();
  return { user, api: authedApi(user.cookie) };
}

describe('whats-new', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('is pending until the user closes it', async () => {
    const { api } = await signUpClient();

    const first = await api.settings['whats-new'].get();
    expect(first.status).toBe(200);
    expect(first.data?.pending).toBe(true);

    const seen = await api.settings['whats-new'].seen.post();
    expect(seen.data?.version).toBe(first.data!.version);

    const second = await api.settings['whats-new'].get();
    expect(second.data?.pending).toBe(false);
  });

  it('carries the running release, from the changelog when the feed is unreachable', async () => {
    const { api } = await signUpClient();

    const res = await api.settings['whats-new'].get();
    const running = res.data!.version;
    // The suite never reads the release feed, so the notes come from CHANGELOG.md.
    expect(res.data?.releases.map((r) => r.version)).toEqual([running]);
    expect(res.data?.releases[0]?.notesFormat).toBe('markdown');
  });

  it('gives the instance owner the migration report', async () => {
    const { api } = await signUpClient();
    await recordTeamsUpgrade();

    const res = await api.settings['whats-new'].get();
    expect(res.data?.migration).toMatchObject({ movedInvites: 2 });
    expect(res.data?.migration?.renamed.roles).toHaveLength(1);
  });

  it('hides the report from an account that is not the instance owner', async () => {
    await signUpClient();
    const other = await signUpClient();
    await recordTeamsUpgrade();

    const res = await other.api.settings['whats-new'].get();
    expect(res.data?.migration).toBeNull();
    expect(res.data?.backup).toBeNull();
  });

  it('hides the report on an upgrade that did not apply its migration', async () => {
    const { api } = await signUpClient();
    await recordTeamsUpgrade();
    await setSetting('migration.last', { migrations: ['0120_later_release'] });

    const res = await api.settings['whats-new'].get();
    expect(res.data?.migration).toBeNull();
  });

  it('hides the report on a fresh install, which applied nothing over existing data', async () => {
    const { api } = await signUpClient();
    await setSetting('migration.teams', REPORT);

    const res = await api.settings['whats-new'].get();
    expect(res.data?.migration).toBeNull();
  });
});
