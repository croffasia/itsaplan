import { afterAll, describe, expect, it } from 'bun:test';
import { giteaRequest } from '../client';

// The instance URL is entered by whoever edits the team's integrations, so a call to it
// goes through the SSRF guard like every other configured address.
describe('gitea client address', () => {
  const hits: string[] = [];
  const internal = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(req) {
      hits.push(new URL(req.url).pathname);
      return Response.json({ message: 'internal service answer' }, { status: 400 });
    },
  });
  afterAll(() => internal.stop(true));

  it('refuses a loopback instance URL without sending the request', async () => {
    const credential = { baseUrl: `http://127.0.0.1:${internal.port}`, token: 't' };
    await expect(giteaRequest(credential, 'GET', 'repos/a/b/issues')).rejects.toThrow();
    expect(hits).toEqual([]);
  });
});
