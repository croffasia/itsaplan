// Fills the local instance with known data for documentation captures. Safe to re-run.
const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const ORIGIN = process.env.APP_URL ?? 'http://localhost:3001';
const PASSWORD = 'seed-password-123';
const OWNER = { email: 'seed-owner@example.test', name: 'Seed Owner' };
const MEMBER = { email: 'seed-member@example.test', name: 'Seed Member' };
const TEAM = { name: 'Seed Team', slug: 'seed-team' };
const PROJECT = { key: 'SEED', name: 'Seed Project' };
const ISSUE_COUNT = 12;

type Session = { cookie: string; userId: string };

class ApiFailure extends Error {
  readonly code?: string;
  constructor(method: string, path: string, status: number, text: string) {
    super(`${method} ${path} -> ${status}: ${text}`);
    try {
      this.code = (JSON.parse(text) as { code?: string }).code;
    } catch {
      this.code = undefined;
    }
  }
}

async function call<T>(path: string, init: RequestInit & { cookie?: string } = {}): Promise<T> {
  const { cookie, ...rest } = init;
  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'content-type': 'application/json',
      origin: ORIGIN,
      ...(cookie ? { cookie } : {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new ApiFailure(rest.method ?? 'GET', path, response.status, text);
  return (text ? JSON.parse(text) : null) as T;
}

async function list<T>(path: string, init: { cookie?: string }): Promise<T[]> {
  const body = await call<T[] | { items: T[] }>(path, init);
  return Array.isArray(body) ? body : body.items;
}

type Attempt = { session: Session } | { failure: string };

async function authenticate(path: string, body: object): Promise<Attempt> {
  const response = await fetch(`${API_URL}/api/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) return { failure: `${path} answered ${response.status} ${text}` };
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const userId = (JSON.parse(text) as { user?: { id?: string } }).user?.id;
  return cookie && userId
    ? { session: { cookie, userId } }
    : { failure: `${path} returned no session` };
}

export async function signUpOrSignIn(account: { email: string; name: string }): Promise<Session> {
  const created = await authenticate('sign-up/email', { ...account, password: PASSWORD });
  if ('session' in created) return created.session;
  const signedIn = await authenticate('sign-in/email', {
    email: account.email,
    password: PASSWORD,
  });
  if ('session' in signedIn) return signedIn.session;
  throw new Error(
    `cannot sign up or sign in ${account.email}: ${created.failure}; ${signedIn.failure}`,
  );
}

type Team = { id: number; name: string };
type Project = { key: string; name: string };
type Column = { id: number; name: string };

export async function ensureProject(owner: Session): Promise<Project> {
  const workspaces = await list<{ id: number; role: string }>('/workspaces', owner);
  const workspace = workspaces.find((w) => w.role === 'owner');
  if (!workspace) {
    throw new Error('the owner account has no workspace (personal workspaces may be off)');
  }
  const teams = await list<Team>('/teams', owner);
  const team =
    teams.find((t) => t.name === TEAM.name) ??
    (await call<Team>('/teams', {
      ...owner,
      method: 'POST',
      body: JSON.stringify({ ...TEAM, workspaceId: workspace.id }),
    }));
  const projects = await list<Project>(`/teams/${team.id}/projects`, owner);
  const existing = projects.find((p) => p.key === PROJECT.key);
  if (existing) return existing;
  return call<Project>(`/teams/${team.id}/projects`, {
    ...owner,
    method: 'POST',
    body: JSON.stringify(PROJECT),
  });
}

export async function ensureMember(owner: Session, member: Session): Promise<void> {
  const members = await list<{ userId: string }>(`/projects/${PROJECT.key}/members`, owner);
  if (members.some((m) => m.userId === member.userId)) return;
  const accept = (token: string) => call(`/invites/${token}/accept`, { ...member, method: 'POST' });
  try {
    const invite = await call<{ token: string }>(`/projects/${PROJECT.key}/invites`, {
      ...owner,
      method: 'POST',
      body: JSON.stringify({ email: MEMBER.email, role: 'member' }),
    });
    await accept(invite.token);
  } catch (error) {
    if (!(error instanceof ApiFailure)) throw error;
    if (error.code === 'INVITE_ALREADY_PENDING') {
      const invites = await list<{ email: string; token: string | null }>(
        `/projects/${PROJECT.key}/invites`,
        owner,
      );
      const pending = invites.find((invite) => invite.email === MEMBER.email && invite.token);
      if (!pending?.token) throw error;
      await accept(pending.token);
    } else if (error.code === 'ALREADY_TEAM_MEMBER') {
      await call(`/projects/${PROJECT.key}/members`, {
        ...owner,
        method: 'POST',
        body: JSON.stringify({ userId: member.userId, role: 'member' }),
      });
    } else {
      throw error;
    }
  }
}

export async function ensureIssues(owner: Session, member: Session): Promise<number> {
  const have = (
    await call<unknown[]>(`/projects/${PROJECT.key}/issues?includeArchived=true`, owner)
  ).length;
  const detail = await call<{ columns: Column[] }>(`/projects/${PROJECT.key}`, owner);
  if (have < ISSUE_COUNT && detail.columns.length === 0) {
    throw new Error(`project ${PROJECT.key} has no columns to put issues in`);
  }
  for (let i = have; i < ISSUE_COUNT; i += 1) {
    await call(`/projects/${PROJECT.key}/issues`, {
      ...owner,
      method: 'POST',
      body: JSON.stringify({
        title: `Seed issue ${i + 1}`,
        columnId: detail.columns[i % detail.columns.length].id,
        ...(i % 3 === 0 ? { assigneeUserId: member.userId } : {}),
      }),
    });
  }
  return Math.max(0, ISSUE_COUNT - have);
}

export async function ensureDashboard(owner: Session): Promise<boolean> {
  const dashboards = await list<{ name: string }>(`/projects/${PROJECT.key}/dashboards`, owner);
  if (dashboards.some((d) => d.name === 'Seed overview')) return false;
  await call(`/projects/${PROJECT.key}/dashboards`, {
    ...owner,
    method: 'POST',
    body: JSON.stringify({ name: 'Seed overview' }),
  });
  return true;
}

export async function run(print: (line: string) => void = console.log): Promise<number> {
  try {
    const owner = await signUpOrSignIn(OWNER);
    const member = await signUpOrSignIn(MEMBER);
    const project = await ensureProject(owner);
    print(`project ${project.key}: ready`);
    await ensureMember(owner, member);
    print('member: ready');
    print(`issues: created ${await ensureIssues(owner, member)}`);
    print(`dashboard: ${(await ensureDashboard(owner)) ? 'created' : 'exists'}`);
    return 0;
  } catch (error) {
    print(`seed failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (import.meta.main) process.exit(await run());
