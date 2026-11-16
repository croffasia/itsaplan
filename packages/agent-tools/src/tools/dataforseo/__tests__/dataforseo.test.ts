import { afterAll, afterEach, describe, expect, it, spyOn } from 'bun:test';
import { getTool } from '../../../registry';
import { dataforseoSerp } from '../serp';
import { dataforseoRankedKeywords } from '../ranked-keywords';
import { dataforseoPageAudit } from '../page-audit';
import { verifyDataforseo } from '../verify';

const fetchSpy = spyOn(globalThis, 'fetch');
const credential = { login: 'me@example.com', password: 'secret' };

function respond(result: unknown, taskStatus = 20000, taskMessage = 'Ok.') {
  fetchSpy.mockResolvedValue(
    Response.json({
      status_code: 20000,
      status_message: 'Ok.',
      tasks: [{ status_code: taskStatus, status_message: taskMessage, result: [result] }],
    }),
  );
}

function lastCall() {
  const [url, init] = fetchSpy.mock.calls.at(-1)!;
  return { url: String(url), init: init as RequestInit & { headers: Record<string, string> } };
}

describe('dataforseo', () => {
  afterEach(() => fetchSpy.mockClear());
  afterAll(() => fetchSpy.mockRestore());

  it('is registered with a login and a secret password', () => {
    const integration = getTool('dataforseo_serp')?.integration;
    expect(integration?.key).toBe('dataforseo');
    expect(integration?.credentialSchema.map((f) => [f.key, f.type])).toEqual([
      ['login', 'string'],
      ['password', 'secret'],
    ]);
  });

  it('posts one task with basic auth and the default market, and keeps organic results', async () => {
    respond({
      se_results_count: 1200,
      item_types: ['organic', 'people_also_ask'],
      items: [
        { type: 'people_also_ask', rank_group: 1 },
        {
          type: 'organic',
          rank_group: 1,
          title: 'Plan',
          url: 'https://example.com/',
          domain: 'example.com',
          description: 'A tracker',
          xpath: '/html/body',
        },
      ],
    });
    const result = await dataforseoSerp.execute(credential, { keyword: 'project tracker' });

    const { url, init } = lastCall();
    expect(url).toBe('https://api.dataforseo.com/v3/serp/google/organic/live/advanced');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Basic ${btoa('me@example.com:secret')}`);
    expect(JSON.parse(String(init.body))).toEqual([
      {
        keyword: 'project tracker',
        location_name: 'United States',
        language_name: 'English',
      },
    ]);
    expect(result).toEqual({
      totalResults: 1200,
      features: ['organic', 'people_also_ask'],
      results: [
        {
          rank: 1,
          title: 'Plan',
          url: 'https://example.com/',
          domain: 'example.com',
          description: 'A tracker',
        },
      ],
    });
  });

  it('maps a ranked keyword from its keyword data and SERP element', async () => {
    respond({
      total_count: 1,
      metrics: { organic: { count: 1, etv: 40 } },
      items: [
        {
          keyword_data: {
            keyword: 'tracker',
            keyword_info: { search_volume: 900, cpc: 1.5, competition_level: 'LOW' },
            keyword_properties: { keyword_difficulty: 30 },
            search_intent_info: { main_intent: 'commercial' },
          },
          ranked_serp_element: {
            serp_item: { type: 'organic', rank_group: 3, url: 'https://example.com/a', etv: 40 },
          },
        },
      ],
    });
    const result = await dataforseoRankedKeywords.execute(credential, {
      target: 'example.com',
      location: 'Germany',
      language: 'German',
      limit: 5,
    });

    expect(JSON.parse(String(lastCall().init.body))).toEqual([
      {
        target: 'example.com',
        location_name: 'Germany',
        language_name: 'German',
        limit: 5,
        order_by: ['keyword_data.keyword_info.search_volume,desc'],
      },
    ]);
    expect(result).toEqual({
      totalCount: 1,
      metrics: { organic: { count: 1, etv: 40 } },
      keywords: [
        {
          keyword: 'tracker',
          searchVolume: 900,
          cpc: 1.5,
          competition: 'LOW',
          difficulty: 30,
          intent: 'commercial',
          rank: 3,
          resultType: 'organic',
          url: 'https://example.com/a',
          traffic: 40,
        },
      ],
    });
  });

  it('lists only the checks that are true for a page', async () => {
    respond({
      items: [
        {
          url: 'https://example.com/',
          status_code: 200,
          onpage_score: 91.5,
          meta: { title: 'Home', htags: { h2: ['A'] } },
          checks: { is_https: true, no_h1_tag: true, title_too_long: false },
        },
      ],
    });
    const result = (await dataforseoPageAudit.execute(credential, {
      url: 'https://example.com/',
    })) as { h1: string[]; checks: string[]; score: number };
    expect(result.checks).toEqual(['is_https', 'no_h1_tag']);
    expect(result.h1).toEqual([]);
    expect(result.score).toBe(91.5);
  });

  it('throws the status a task failed with although the HTTP status is 200', async () => {
    respond(null, 40501, 'Invalid Field: location_name.');
    await expect(dataforseoSerp.execute(credential, { keyword: 'x' })).rejects.toThrow(
      'DataForSEO search results failed (40501): Invalid Field: location_name.',
    );
    fetchSpy.mockResolvedValue(
      Response.json({ status_code: 40210, status_message: 'Insufficient Funds.', tasks: null }),
    );
    await expect(dataforseoSerp.execute(credential, { keyword: 'x' })).rejects.toThrow(
      'DataForSEO search results failed (40210): Insufficient Funds.',
    );
  });

  it('checks a credential with the free account data call', async () => {
    const check = (status: number, statusCode: number) => {
      fetchSpy.mockResolvedValue(Response.json({ status_code: statusCode }, { status }));
      return verifyDataforseo(credential, new AbortController().signal);
    };
    expect(await check(200, 20000)).toBe('valid');
    expect(await check(401, 40100)).toBe('rejected');
    expect(await check(200, 50000)).toBe('unavailable');
    expect(await check(500, 50000)).toBe('unavailable');
    expect(lastCall().url).toBe('https://api.dataforseo.com/v3/appendix/user_data');

    fetchSpy.mockResolvedValue(new Response('<html></html>', { status: 401 }));
    expect(await verifyDataforseo(credential, new AbortController().signal)).toBe('unavailable');
  });
});
