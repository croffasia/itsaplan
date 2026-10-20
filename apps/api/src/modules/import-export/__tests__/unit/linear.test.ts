import { describe, it, expect } from 'bun:test';
import type { PinnedRequestInit } from '@repo/net';
import { HttpError } from '#shared/lib';
import {
  LINEAR_GRAPHQL_URL,
  linearJobFields,
  previewLinearStates,
  testLinearConnection,
  type LinearFetch,
} from '../../linear';

interface SentRequest {
  url: string;
  init: PinnedRequestInit | undefined;
}

function answering(responses: (Response | Error)[], sent: SentRequest[] = []): LinearFetch {
  const queue = [...responses];
  return async (url, init) => {
    sent.push({ url, init });
    const next = queue.shift();
    if (!next) throw new Error(`unexpected request ${url}`);
    if (next instanceof Error) throw next;
    return next;
  };
}

function page<T>(nodes: T[], endCursor: string | null, hasNextPage: boolean) {
  return { connection: { nodes, pageInfo: { hasNextPage, endCursor } } };
}

async function httpError(promise: Promise<unknown>): Promise<HttpError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpError);
  return error as HttpError;
}

describe('testLinearConnection', () => {
  it('sends the bare key to Linear only and lists every team with its projects', async () => {
    const sent: SentRequest[] = [];
    const fetch = answering(
      [
        Response.json({
          data: page(
            [
              { id: 't1', key: 'ATO', name: 'Atomlab' },
              { id: 't2', key: 'AMA', name: 'AmandaHuie' },
            ],
            null,
            false,
          ),
        }),
        Response.json({
          data: page(
            [{ id: 'p2', name: 'The Tool', teams: { nodes: [{ id: 't1' }] } }],
            'c1',
            true,
          ),
        }),
        Response.json({
          data: page(
            [{ id: 'p1', name: 'HeadInMyVoices', teams: { nodes: [{ id: 't1' }, { id: 't2' }] } }],
            null,
            false,
          ),
        }),
      ],
      sent,
    );

    expect(await testLinearConnection('  lin_api_key  ', fetch)).toEqual({
      teams: [
        {
          id: 't1',
          key: 'ATO',
          name: 'Atomlab',
          projects: [
            { id: 'p1', name: 'HeadInMyVoices' },
            { id: 'p2', name: 'The Tool' },
          ],
        },
        {
          id: 't2',
          key: 'AMA',
          name: 'AmandaHuie',
          projects: [{ id: 'p1', name: 'HeadInMyVoices' }],
        },
      ],
    });
    expect(sent.map((r) => r.url)).toEqual([
      LINEAR_GRAPHQL_URL,
      LINEAR_GRAPHQL_URL,
      LINEAR_GRAPHQL_URL,
    ]);
    expect(sent[0]!.init).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'lin_api_key', 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(String(sent[2]!.init?.body)).variables).toEqual({ after: 'c1' });
  });

  it('answers 400 when Linear rejects the key', async () => {
    const fetch = answering([
      Response.json(
        {
          errors: [
            {
              message: 'Authentication required, not authenticated',
              extensions: { code: 'AUTHENTICATION_ERROR' },
            },
          ],
        },
        { status: 401 },
      ),
    ]);
    const error = await httpError(testLinearConnection('lin_api_bad', fetch));
    expect(error.status).toBe(400);
    expect(error.message).toBe('Linear rejected the API key.');
  });

  it('answers 502 on a rate limit, an unreachable Linear, or a failed request', async () => {
    const limited = answering([
      Response.json(
        { errors: [{ message: 'Rate limit exceeded', extensions: { code: 'RATELIMITED' } }] },
        { status: 400 },
      ),
    ]);
    expect((await httpError(testLinearConnection('k', limited))).message).toBe(
      "Linear's rate limit was reached. Try again in a few minutes.",
    );
    const down = answering([new Error('connect ECONNREFUSED')]);
    expect((await httpError(testLinearConnection('k', down))).message).toBe(
      'Linear could not be reached.',
    );
    const broken = answering([new Response('oops', { status: 500 })]);
    const error = await httpError(testLinearConnection('k', broken));
    expect([error.status, error.message]).toEqual([502, 'Linear request failed with status 500.']);
  });

  it('refuses a blank key without calling Linear', async () => {
    const sent: SentRequest[] = [];
    const error = await httpError(testLinearConnection('   ', answering([], sent)));
    expect([error.status, error.message]).toEqual([400, 'apiToken is required']);
    expect(sent).toEqual([]);
  });
});

describe('previewLinearStates', () => {
  it("lists the team's states in Linear's order with the category each maps to", async () => {
    const sent: SentRequest[] = [];
    const fetch = answering(
      [
        Response.json({
          data: {
            team: page(
              [
                { id: 's3', name: 'Done', type: 'completed', position: 3 },
                { id: 's1', name: 'Triage', type: 'triage', position: 0 },
                { id: 's4', name: 'Duplicate', type: 'duplicate', position: 5 },
                { id: 's2', name: 'In Review', type: 'started', position: 2 },
              ],
              null,
              false,
            ),
          },
        }),
      ],
      sent,
    );

    expect(await previewLinearStates('k', 'team-1', fetch)).toEqual({
      states: [
        { id: 's1', name: 'Triage', category: 'backlog' },
        { id: 's2', name: 'In Review', category: 'started' },
        { id: 's3', name: 'Done', category: 'completed' },
        { id: 's4', name: 'Duplicate', category: 'canceled' },
      ],
    });
    expect(JSON.parse(String(sent[0]!.init?.body)).variables).toEqual({
      teamId: 'team-1',
      after: null,
    });
  });
});

describe('Linear user errors', () => {
  it('answers 400 when the team does not exist or the key cannot see it', async () => {
    const fetch = answering([Response.json({ data: { team: null } })]);
    const error = await httpError(previewLinearStates('k', 'team-gone', fetch));
    expect([error.status, error.message]).toEqual([400, 'Linear team not found.']);
  });

  it.each([
    ['INVALID_INPUT', 'invalid input', 'Entity not found: Team', 'Could not find referenced Team.'],
    ['FORBIDDEN', 'forbidden', 'Forbidden', 'You do not have access to this team.'],
  ])('answers 400 with what Linear said for a %s error', async (code, type, message, shown) => {
    const fetch = answering([
      Response.json({
        data: null,
        errors: [
          {
            message,
            extensions: { code, type, userError: true, userPresentableMessage: shown },
          },
        ],
      }),
    ]);
    const error = await httpError(previewLinearStates('k', 'team-1', fetch));
    expect([error.status, error.message]).toEqual([400, `Linear refused the request: ${shown}`]);
  });

  it("still answers 502 for an error that is not the caller's", async () => {
    const fetch = answering([
      Response.json({
        data: null,
        errors: [{ message: 'boom', extensions: { code: 'INTERNAL_ERROR', userError: false } }],
      }),
    ]);
    const error = await httpError(previewLinearStates('k', 'team-1', fetch));
    expect([error.status, error.message]).toEqual([502, 'Linear request failed with status 200.']);
  });
});

describe('linearJobFields', () => {
  const base = {
    source: 'linear' as const,
    apiToken: ' lin_api_key ',
    teamId: 'team-1',
    teamKey: 'ATO',
  };

  it('stores the key as the credential and the scope as the config the worker reads', () => {
    expect(linearJobFields({ ...base, projectFilter: 'project', projectId: 'p-1' })).toEqual({
      source: 'linear',
      credential: { apiKey: 'lin_api_key' },
      config: { teamId: 'team-1', teamKey: 'ATO', projectFilter: 'project', projectId: 'p-1' },
    });
    expect(linearJobFields({ ...base, projectFilter: 'none' }).config).toEqual({
      teamId: 'team-1',
      teamKey: 'ATO',
      projectFilter: 'none',
      projectId: null,
    });
  });

  it('refuses a scope that does not match its filter', () => {
    expect(() => linearJobFields({ ...base, projectFilter: 'project' })).toThrow(
      'projectId is required to import a project',
    );
    expect(() => linearJobFields({ ...base, projectFilter: 'none', projectId: 'p-1' })).toThrow(
      'projectId must be empty to import issues with no project',
    );
    expect(() => linearJobFields({ ...base, teamKey: ' ', projectFilter: 'none' })).toThrow(
      'teamKey is required',
    );
  });
});
