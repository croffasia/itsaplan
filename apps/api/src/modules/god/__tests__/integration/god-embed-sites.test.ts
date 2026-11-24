import { describe, it, expect, beforeEach } from 'bun:test';
import { app } from '../../../../app';
import { resetDb } from '#tests/helpers/db';
import { addUser, setup } from '../helpers';

// The sites the instance owner lets show the public pages in a frame. Only the owner
// changes them; anyone reads them, since the web app's proxy does so with no session.

const publicRead = async () =>
  (await app.handle(new Request('http://localhost/embed-sites'))).json() as Promise<{
    origins: string[];
  }>;

describe('god embed sites', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('refuses both routes for a user who is not the instance owner', async () => {
    await setup();
    const outsider = await addUser();

    expect((await outsider.api.god['embed-sites'].get()).status).toBe(403);
    expect((await outsider.api.god['embed-sites'].put({ origins: [] })).status).toBe(403);
  });

  it('starts with no site, and reads the list without a session', async () => {
    const { god } = await setup();

    expect((await god.api.god['embed-sites'].get()).data).toEqual({ origins: [] });
    expect(await publicRead()).toEqual({ origins: [] });
  });

  it('stores each site as its origin, once', async () => {
    const { god } = await setup();

    const put = await god.api.god['embed-sites'].put({
      origins: ['https://Example.com/', ' https://example.com', 'http://localhost:5055'],
    });

    expect(put.data).toEqual({ origins: ['https://example.com', 'http://localhost:5055'] });
    expect(await publicRead()).toEqual(put.data!);
  });

  it('refuses an address with a path, another scheme, or no host', async () => {
    const { god } = await setup();
    const put = (origin: string) => god.api.god['embed-sites'].put({ origins: [origin] });

    expect((await put('https://example.com/forms')).status).toBe(400);
    expect((await put('javascript:alert(1)')).status).toBe(400);
    expect((await put("https://a.com; script-src 'unsafe-eval'")).status).toBe(400);
    expect((await put('https://a.com;sandbox')).status).toBe(400);
    expect((await put('example.com')).status).toBe(400);
    expect(await publicRead()).toEqual({ origins: [] });
  });
});
