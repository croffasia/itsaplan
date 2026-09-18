import { describe, it, expect } from 'bun:test';
import { Client, RequestError } from '../client';

// The mirror reads everything over GET with the runner's key. If the client's GET stopped
// sending the key or stopped throwing on a non-2xx, the mirror would silently write nothing.

describe('Client.get', () => {
  it('sends the key and returns the parsed body', async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(url), headers: (init?.headers as Record<string, string>) ?? {} });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;
    try {
      const client = new Client({ url: 'http://h', apiKey: 'k1' });
      await expect(client.get<{ ok: boolean }>('/projects')).resolves.toEqual({ ok: true });
      expect(seen[0]).toMatchObject({ url: 'http://h/projects', headers: { 'x-api-key': 'k1' } });
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('throws a RequestError carrying the status on a non-2xx answer', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response('nope', { status: 403 })) as typeof fetch;
    try {
      const client = new Client({ url: 'http://h', apiKey: 'k1' });
      await expect(client.get('/projects')).rejects.toBeInstanceOf(RequestError);
      await expect(client.get('/projects')).rejects.toMatchObject({ status: 403 });
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
