import { describe, it, expect, beforeEach } from 'bun:test';
import { resetDb } from '#tests/helpers/db';
import { addUser, setup } from '../helpers';

// The update check under god mode. Only the instance owner may read it — they are
// the one who upgrades — while the running version alone is open to any signed-in
// user, because the sidebar shows it to everyone.
//
// Under NODE_ENV=test nothing is fetched, so the releases are the changelog of this
// build. The parsers have unit tests.

describe('god updates', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('access', () => {
    it('refuses both routes for a user who is not the instance owner', async () => {
      await setup();
      const outsider = await addUser();

      expect((await outsider.api.god.updates.get()).status).toBe(403);
      expect((await outsider.api.god.updates.check.post()).status).toBe(403);
    });

    it('serves the running version to any signed-in user', async () => {
      const { god } = await setup();
      const member = await addUser();

      const res = await member.api.settings.version.get();
      const owner = await god.api.god.updates.get();

      expect(res.status).toBe(200);
      expect(res.data?.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(res.data?.version).toBe(owner.data!.currentVersion);
    });
  });

  describe('status — GET /god/updates', () => {
    it('offers no update when the feed cannot be read', async () => {
      const { god } = await setup();

      const res = await god.api.god.updates.get();

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({
        latestVersion: null,
        updateAvailable: false,
        checkedAt: null,
      });
    });

    it('serves the release history from the changelog of this build', async () => {
      const { god } = await setup();

      const res = await god.api.god.updates.get();
      const running = res.data!.releases.find((r) => r.version === res.data!.currentVersion);

      // Every release the build knows about is at or below the version it runs.
      expect(res.data!.releases.length).toBeGreaterThan(0);
      expect(running).toMatchObject({ notesFormat: 'markdown', url: null });
      expect(running!.notes.length).toBeGreaterThan(0);
    });
  });

  describe('check — POST /god/updates/check', () => {
    it('answers with the status even when the feed cannot be read', async () => {
      const { god } = await setup();

      const res = await god.api.god.updates.check.post();

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ updateAvailable: false });
    });
  });
});
