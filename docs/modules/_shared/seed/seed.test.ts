import { afterAll, beforeAll, beforeEach, expect, test } from 'bun:test';

type Handler = (request: Request, body: unknown) => Response | undefined;

let server: ReturnType<typeof Bun.serve>;
let handlers: Handler[] = [];
let calls: string[] = [];

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      calls.push(`${request.method} ${url.pathname}${url.search}`);
      const text = await request.text();
      const body = text ? JSON.parse(text) : null;
      for (const handler of handlers) {
        const response = handler(request, body);
        if (response) return response;
      }
      return new Response('{"error":"unhandled"}', { status: 500 });
    },
  });
  process.env.API_URL = `http://localhost:${server.port}`;
});

afterAll(() => server.stop(true));

beforeEach(() => {
  handlers = [];
  calls = [];
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const at = (method: string, path: string, answer: () => Response): Handler => {
  return (request) => {
    const url = new URL(request.url);
    return request.method === method && url.pathname === path ? answer() : undefined;
  };
};
const session = { cookie: 'c=1', userId: 'u1' };

test('a refused sign-up and sign-in error names both statuses and bodies', async () => {
  const { signUpOrSignIn } = await import('./seed');
  handlers = [
    at('POST', '/api/auth/sign-up/email', () => json(403, { error: 'sign-up disabled' })),
    at('POST', '/api/auth/sign-in/email', () => json(401, { error: 'bad credentials' })),
  ];
  const failure = await signUpOrSignIn({ email: 'a@example.test', name: 'A' }).catch((e) => e);
  expect(failure.message).toContain('a@example.test');
  expect(failure.message).toContain('403');
  expect(failure.message).toContain('sign-up disabled');
  expect(failure.message).toContain('401');
});

test('ensureMember accepts the pending invite instead of creating another', async () => {
  const { ensureMember } = await import('./seed');
  handlers = [
    at('GET', '/projects/SEED/members', () => json(200, [])),
    at('POST', '/projects/SEED/invites', () =>
      json(409, { error: 'pending', code: 'INVITE_ALREADY_PENDING' }),
    ),
    at('GET', '/projects/SEED/invites', () =>
      json(200, [{ email: 'seed-member@example.test', token: 'tok' }]),
    ),
    at('POST', '/invites/tok/accept', () => json(200, {})),
  ];
  await ensureMember(session, { cookie: 'm=1', userId: 'u2' });
  expect(calls).toContain('POST /invites/tok/accept');
});

test('ensureMember adds a team member to the project directly', async () => {
  const { ensureMember } = await import('./seed');
  let added: unknown;
  handlers = [
    at('GET', '/projects/SEED/members', () => json(200, [])),
    at('POST', '/projects/SEED/invites', () =>
      json(409, { error: 'in team', code: 'ALREADY_TEAM_MEMBER' }),
    ),
    (request, body) => {
      if (request.method !== 'POST' || new URL(request.url).pathname !== '/projects/SEED/members') {
        return undefined;
      }
      added = body;
      return json(201, {});
    },
  ];
  await ensureMember(session, { cookie: 'm=1', userId: 'u2' });
  expect(added).toEqual({ userId: 'u2', role: 'member' });
});

test('ensureIssues counts archived issues and rejects a project without columns', async () => {
  const { ensureIssues } = await import('./seed');
  handlers = [
    (request) =>
      request.method === 'GET' && new URL(request.url).pathname === '/projects/SEED/issues'
        ? json(200, [])
        : undefined,
    at('GET', '/projects/SEED', () => json(200, { columns: [] })),
  ];
  await expect(ensureIssues(session, session)).rejects.toThrow('no columns');
  expect(calls.some((call) => call.includes('includeArchived=true'))).toBe(true);
});

test('run reports a failure as one line and an exit code, not a stack', async () => {
  const { run } = await import('./seed');
  handlers = [at('POST', '/api/auth/sign-up/email', () => json(500, { error: 'down' }))];
  const lines: string[] = [];
  const code = await run((line) => lines.push(line));
  expect(code).toBe(1);
  expect(lines.join('\n')).toContain('seed failed');
  expect(lines.join('\n')).not.toContain('at ');
});
