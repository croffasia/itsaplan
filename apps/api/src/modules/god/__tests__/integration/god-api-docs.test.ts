import { describe, it, expect, beforeEach } from 'bun:test';
import { app, authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { addUser, setup, type Actor } from '../helpers';

// Who may read the API docs. God mode picks the audience; every signed-in user reads only
// whether they are in it, and the api serves its references to that audience alone.

const visible = async (actor: Actor) => (await actor.api.settings['api-docs'].get()).data?.visible;

const REFERENCES = [
  '/docs',
  '/docs/json',
  '/api/auth/reference',
  '/api/auth/open-api/generate-schema',
];

const read = (path: string, cookie?: string) =>
  app.handle(new Request(`http://localhost${path}`, { headers: cookie ? { cookie } : {} }));

describe('god API docs settings', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('refuses both god routes for a user who is not the instance owner', async () => {
    await setup();
    const outsider = await addUser();

    expect((await outsider.api.god['api-docs-settings'].get()).status).toBe(403);
    expect((await outsider.api.god['api-docs-settings'].put({ audience: 'god' })).status).toBe(403);
  });

  it('starts with everyone, and stores a change', async () => {
    const { god } = await setup();
    expect((await god.api.god['api-docs-settings'].get()).data).toEqual({ audience: 'everyone' });

    const put = await god.api.god['api-docs-settings'].put({ audience: 'god' });

    expect(put.status).toBe(200);
    expect((await god.api.god['api-docs-settings'].get()).data).toEqual({ audience: 'god' });
  });

  it('refuses an audience it does not know', async () => {
    const { god } = await setup();

    const put = await god.api.god['api-docs-settings'].put({ audience: 'guests' as 'god' });

    expect(put.status).toBe(400);
  });

  it('shows the entry to a plain user while the audience is everyone', async () => {
    await setup();
    const user = await addUser();

    expect(await visible(user)).toBe(true);
  });

  it('shows the entry only to the instance owner while the audience is god', async () => {
    const { god } = await setup();
    const owner = await addUser();
    await god.api.god['api-docs-settings'].put({ audience: 'god' });

    expect(await visible(god)).toBe(true);
    expect(await visible(owner)).toBe(false);
  });

  it('shows the entry to no one, the instance owner included, while the audience is nobody', async () => {
    const { god } = await setup();
    await god.api.god['api-docs-settings'].put({ audience: 'nobody' });

    expect(await visible(god)).toBe(false);
  });

  describe('the API references', () => {
    it('refuses a request without a session', async () => {
      for (const path of REFERENCES) expect((await read(path)).status).toBe(401);
    });

    it('serves no reference without a session under another form of its path', async () => {
      for (const path of REFERENCES) expect((await read(`${path}/`)).status).not.toBe(200);
      // Elysia takes the path from the 12th character of the URL, so a one-letter host
      // makes it route this request to /docs/json.
      const shifted = await app.handle(new Request('http://a/xx/docs/json'));
      expect(shifted.status).toBe(401);
    });

    it('serves everyone signed in under the default audience', async () => {
      await setup();
      const user = await signUpTestUser();

      for (const path of REFERENCES) expect((await read(path, user.cookie)).status).toBe(200);
    });

    it('refuses the instance owner while the audience is nobody', async () => {
      const god = await signUpTestUser();
      await authedApi(god.cookie).god['api-docs-settings'].put({ audience: 'nobody' });

      for (const path of REFERENCES) expect((await read(path, god.cookie)).status).toBe(403);
    });

    it('refuses a user outside the audience and serves the instance owner', async () => {
      const god = await signUpTestUser();
      const user = await signUpTestUser();
      await authedApi(god.cookie).god['api-docs-settings'].put({ audience: 'god' });

      for (const path of REFERENCES) {
        expect((await read(path, user.cookie)).status).toBe(403);
        expect((await read(path, god.cookie)).status).toBe(200);
      }
    });
  });
});
