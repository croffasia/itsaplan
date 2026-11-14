import { afterAll, afterEach, describe, expect, it, spyOn } from 'bun:test';
import { getTool } from '../../../registry';
import { keenableSearch } from '../search';
import { keenableFetch } from '../fetch';
import { verifyKeenable } from '../verify';

const fetchSpy = spyOn(globalThis, 'fetch');

// Each test makes one call per response, so one Response object is enough.
function respond(status: number, body: unknown) {
  fetchSpy.mockResolvedValue(Response.json(body, { status }));
}

function lastCall() {
  const [url, init] = fetchSpy.mock.calls.at(-1)!;
  return { url: String(url), init: init as RequestInit & { headers: Record<string, string> } };
}

describe('keenable', () => {
  afterEach(() => fetchSpy.mockClear());
  afterAll(() => fetchSpy.mockRestore());

  it('is registered with an API key its tools can also run without', () => {
    const integration = getTool('keenable_search')?.integration;
    expect(integration?.credentialSchema.map((f) => f.key)).toEqual(['apiKey']);
    expect(integration?.credentialOptional).toBe(true);
    expect(getTool('keenable_fetch')?.integration.key).toBe('keenable');
  });

  it('searches the public endpoint with the app header and maps the snippet', async () => {
    respond(200, {
      results: [
        {
          title: 'Rate limiting',
          url: 'https://example.com/rate-limits',
          description: '',
          snippet: 'x'.repeat(5000),
        },
      ],
    });
    const result = (await keenableSearch.execute(
      {},
      { query: 'api rate limits', count: 3, site: 'example.com' },
    )) as { results: { title: string; url: string; snippet: string }[] };

    const { url, init } = lastCall();
    expect(url).toBe('https://api.keenable.ai/v1/search/public');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'X-Keenable-Title': 'itsaplan' });
    expect(JSON.parse(String(init.body))).toEqual({
      query: 'api rate limits',
      max_results: 3,
      site: 'example.com',
    });
    expect(result.results).toEqual([
      { title: 'Rate limiting', url: 'https://example.com/rate-limits', snippet: 'x'.repeat(4000) },
    ]);
  });

  it('asks for five results and no site by default', async () => {
    respond(200, { results: [] });
    const result = await keenableSearch.execute({}, { query: 'itsaplan' });
    expect(JSON.parse(String(lastCall().init.body))).toEqual({ query: 'itsaplan', max_results: 5 });
    expect(result).toEqual({ results: [] });
  });

  it('fetches a page as markdown through the public endpoint', async () => {
    respond(200, {
      url: 'https://example.com/a?b=1',
      title: 'Example',
      content: '# Example',
      description: '',
    });
    const result = await keenableFetch.execute({}, { url: 'https://example.com/a?b=1' });

    const { url, init } = lastCall();
    expect(url).toBe(
      'https://api.keenable.ai/v1/fetch/public?url=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1',
    );
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.headers).toMatchObject({ 'X-Keenable-Title': 'itsaplan' });
    expect(result).toEqual({
      title: 'Example',
      url: 'https://example.com/a?b=1',
      content: '# Example',
    });
  });

  it('sends a key to the keyed endpoints instead of the public ones', async () => {
    respond(200, { results: [] });
    await keenableSearch.execute({ apiKey: 'keen_test' }, { query: 'itsaplan' });
    let call = lastCall();
    expect(call.url).toBe('https://api.keenable.ai/v1/search');
    expect(call.init.headers).toMatchObject({ 'X-API-Key': 'keen_test' });
    expect(call.init.headers).not.toHaveProperty('X-Keenable-Title');

    respond(200, { url: 'https://example.com', title: '', content: '' });
    await keenableFetch.execute({ apiKey: 'keen_test' }, { url: 'https://example.com' });
    call = lastCall();
    expect(call.url).toBe('https://api.keenable.ai/v1/fetch?url=https%3A%2F%2Fexample.com');
    expect(call.init.headers).toMatchObject({ 'X-API-Key': 'keen_test' });
  });

  it('checks a key with a search that has no query', async () => {
    const check = (status: number) => {
      respond(status, { code: 'x' });
      return verifyKeenable({ apiKey: 'keen_test' }, new AbortController().signal);
    };
    expect(await check(400)).toBe('valid');
    expect(await check(402)).toBe('valid');
    expect(await check(401)).toBe('rejected');
    expect(await check(503)).toBe('unavailable');
    const { url, init } = lastCall();
    expect(url).toBe('https://api.keenable.ai/v1/search');
    expect(init.body).toBe('{}');
    expect(init.headers).toMatchObject({ 'X-API-Key': 'keen_test' });

    fetchSpy.mockResolvedValue(new Response('<html></html>', { status: 401 }));
    expect(await verifyKeenable({ apiKey: 'keen_test' }, new AbortController().signal)).toBe(
      'unavailable',
    );
  });

  it('surfaces the status and body of a failed call', async () => {
    respond(429, { detail: 'Rate limit exceeded' });
    await expect(keenableSearch.execute({}, { query: 'x' })).rejects.toThrow(
      'Keenable search failed (429): {"detail":"Rate limit exceeded"}',
    );
    respond(502, { detail: 'upstream error' });
    await expect(keenableFetch.execute({}, { url: 'https://example.com' })).rejects.toThrow(
      'Keenable fetch failed (502)',
    );
  });
});
