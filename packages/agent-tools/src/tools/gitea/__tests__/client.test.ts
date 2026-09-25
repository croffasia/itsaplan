import { describe, it, expect, afterAll } from 'bun:test';
import { createServer, type Server } from 'node:http';
import { UrlNotAllowedError } from '@repo/net';
import { giteaRequest } from '../client';

// The instance URL is operator input, so a call is refused before anything is sent
// when it points at a private or local host. bun test sets NODE_ENV=test, so the
// strict rules apply. A credential stored before url fields were validated is caught
// here as well.
describe('giteaRequest', () => {
  let received = 0;
  const server: Server = createServer((_req, res) => {
    received += 1;
    res.end('{}');
  });
  const ready = new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : 0);
    });
  });
  afterAll(() => server.close());

  it('refuses a private instance address without sending the token', async () => {
    const port = await ready;
    for (const baseUrl of [
      `http://127.0.0.1:${port}`,
      `https://127.0.0.1:${port}`,
      `https://localhost:${port}`,
      'https://169.254.169.254',
    ]) {
      await expect(
        giteaRequest({ baseUrl, token: 'secret' }, 'GET', 'repos/acme/widgets/issues'),
      ).rejects.toBeInstanceOf(UrlNotAllowedError);
    }
    expect(received).toBe(0);
  });

  it('refuses a public hostname that resolves to a private address', async () => {
    await expect(
      giteaRequest({ baseUrl: 'https://localtest.me', token: 'secret' }, 'GET', 'user'),
    ).rejects.toBeInstanceOf(UrlNotAllowedError);
  });

  it('reports a redirect instead of following it', async () => {
    const port = await ready;
    const redirecting = createServer((_req, res) => {
      res.writeHead(302, { Location: `http://127.0.0.1:${port}/api/v1/user` });
      res.end();
    });
    await new Promise<void>((resolve) => redirecting.listen(0, '127.0.0.1', () => resolve()));
    const address = redirecting.address();
    const redirectPort = typeof address === 'object' && address ? address.port : 0;
    const saved = process.env.NODE_ENV;
    // The redirecting server is plain http on loopback, which only the development
    // rules admit; the point here is that the 302 is not followed.
    process.env.NODE_ENV = 'development';
    try {
      await expect(
        giteaRequest(
          { baseUrl: `http://127.0.0.1:${redirectPort}`, token: 'secret' },
          'GET',
          'user',
        ),
      ).rejects.toThrow('redirected the request');
    } finally {
      process.env.NODE_ENV = saved;
      redirecting.close();
    }
    expect(received).toBe(0);
  });
});
