import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { auth } from '@repo/auth';
import { app } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { getMcpClientRequest } from '#shared/mcp-request';
import { setRequestTracker } from '#shared/request-tracker';

describe('a tool call over MCP', () => {
  beforeEach(resetDb);
  afterEach(() => setRequestTracker());

  it('links the request it dispatches to the one that reached /mcp', async () => {
    const owner = await signUpTestUser({ name: 'Owner' });
    const { key } = await auth.api.createApiKey({ body: { userId: owner.userId, name: 'mcp' } });
    const seen: { route: string; device: string | null | undefined }[] = [];
    setRequestTracker(({ request, route }) => {
      seen.push({ route, device: getMcpClientRequest(request)?.headers.get('user-agent') });
      return undefined;
    });

    const answer = await app.handle(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key}`,
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'user-agent': 'mcp-client/1.0',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'list_projects', arguments: {} },
        }),
      }),
    );
    expect(await answer.text()).toContain('"ok":true');

    expect(seen).toEqual([
      { route: '/mcp', device: undefined },
      { route: '/projects', device: 'mcp-client/1.0' },
    ]);
  });
});
