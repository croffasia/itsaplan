import { createHmac } from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { app } from '../../../../app';
import { authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent } from '#tests/helpers/agents';
import { addProjectMember } from '#tests/helpers/members';

// Issue sync with a repository connected through a provider account, against a GitHub
// served on localhost. The SSRF guard refuses http and loopback hosts under
// NODE_ENV=test, so each case runs as development.

interface FakeIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  pullRequest?: boolean;
  comments?: string[];
}

function fakeGithub() {
  const hooks = new Map<number, { url: string; events: string[] }>();
  const issues: FakeIssue[] = [];
  const stateChanges: { number: number; state: string; reason?: string }[] = [];
  const commentReads: number[] = [];
  // Comments written, edited and deleted on the fake, with the token each call used.
  const commentWrites: { method: string; id: number; body?: string; token: string }[] = [];
  // The account /user answers for a token; any other token signs in as 'octo'.
  const accounts: Record<string, { id: number; login: string }> = {};
  // Comments deleted on the fake without a webhook, as GitLab deletes a note.
  const goneComments = new Set<number>();
  // Attached files by id: a private one downloads only by the signed address the rendered
  // HTML names, a missing one not at all, and any other one through a redirect. Before the
  // signed address comes a link the author wrote with the same id, to another server.
  const privateFiles = new Set<string>();
  const missingFiles = new Set<string>();
  const renderedHtml = (origin: string) =>
    [...privateFiles]
      .map(
        (id) =>
          `<a href="https://elsewhere.example/x?${id}">x</a>` +
          `<a href="${origin}/signed/7-${id}.png?jwt=ok"><img src="${origin}/signed/7-${id}.png?jwt=ok"></a>`,
      )
      .join('');
  // labelPages: 'endless' names a next page of new labels forever; 'stuck' names page 1 again.
  const control = {
    refuseIssueWrites: false,
    refuseCommentReads: false,
    labelPages: null as 'endless' | 'stuck' | null,
  };
  const labels = ['bug', 'enhancement'];
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname.replace(/^\/api\/v3/, '');
      const token = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
      if (path === '/user') return Response.json(accounts[token] ?? { id: 1, login: 'octo' });
      const asset = path.match(/^\/user-attachments\/assets\/([0-9a-f-]+)$/);
      if (asset) {
        const id = asset[1]!;
        if (privateFiles.has(id) || missingFiles.has(id))
          return new Response(null, { status: 404 });
        return new Response(null, { status: 302, headers: { location: `/storage/${id}.gif` } });
      }
      if (path.startsWith('/storage/'))
        return new Response('GIF89a', { headers: { 'content-type': 'image/gif' } });
      const signed = path.match(/^\/signed\/7-([0-9a-f-]+)\.png$/);
      if (signed && url.searchParams.get('jwt') === 'ok' && privateFiles.has(signed[1]!))
        return new Response('PNG', { headers: { 'content-type': 'image/png' } });
      const rendered = path.match(/^\/repos\/acme\/site\/issues\/(?:comments\/)?(\d+)$/);
      if (rendered && req.method === 'GET')
        return Response.json({ id: Number(rendered[1]), body_html: renderedHtml(url.origin) });
      if (path === '/repositories/1')
        return Response.json({
          id: 1,
          full_name: 'acme/site',
          html_url: 'https://github.example/acme/site',
          permissions: { admin: true },
        });
      if (path === '/repos/acme/site/hooks' && req.method === 'GET')
        return Response.json(
          [...hooks].map(([id, hook]) => ({ id, config: { url: hook.url }, events: hook.events })),
        );
      if (path === '/repos/acme/site/hooks' && req.method === 'POST') {
        const body = (await req.json()) as { config: { url: string }; events: string[] };
        const id = hooks.size + 1;
        hooks.set(id, { url: body.config.url, events: body.events });
        return Response.json({ id }, { status: 201 });
      }
      const hook = path.match(/^\/repos\/acme\/site\/hooks\/(\d+)$/);
      if (hook && req.method === 'PATCH') {
        const body = (await req.json()) as { config: { url: string }; events: string[] };
        hooks.set(Number(hook[1]), { url: body.config.url, events: body.events });
        return Response.json({ id: Number(hook[1]) });
      }
      if (path === '/repos/acme/site/labels') {
        if (!control.labelPages)
          return Response.json(labels.map((name) => ({ name, color: 'EE0701' })));
        const page = Number(url.searchParams.get('page'));
        const full = Array.from({ length: 50 }, (_, i) => ({ name: `label-${page}-${i}` }));
        return Response.json(full, {
          headers:
            control.labelPages === 'endless'
              ? { link: `<x?page=${page + 1}>; rel="next"` }
              : { 'x-next-page': '1' },
        });
      }
      if (path === '/repos/acme/site/issues') {
        const page = Number(url.searchParams.get('page') ?? 1);
        const perPage = Number(url.searchParams.get('per_page') ?? 50);
        const open = issues.filter((issue) => issue.state === 'open');
        return Response.json(
          open.slice((page - 1) * perPage, page * perPage).map((issue) => githubIssue(issue)),
        );
      }
      const comments = path.match(/^\/repos\/acme\/site\/issues\/(\d+)\/comments$/);
      if (comments && req.method === 'POST') {
        const { body } = (await req.json()) as { body: string };
        const id = 5000 + commentWrites.length;
        commentWrites.push({ method: 'POST', id, body, token });
        return Response.json({ id, body }, { status: 201 });
      }
      const written = path.match(/^\/repos\/acme\/site\/issues\/comments\/(\d+)$/);
      if (written && (req.method === 'PATCH' || req.method === 'DELETE')) {
        if (goneComments.has(Number(written[1])))
          return Response.json({ message: 'Not Found' }, { status: 404 });
        const body =
          req.method === 'PATCH' ? ((await req.json()) as { body: string }).body : undefined;
        commentWrites.push({ method: req.method, id: Number(written[1]), body, token });
        return req.method === 'PATCH'
          ? Response.json({ id: Number(written[1]), body })
          : new Response(null, { status: 204 });
      }
      if (comments) {
        if (control.refuseCommentReads)
          return Response.json({ message: 'Server Error' }, { status: 500 });
        const number = Number(comments[1]);
        commentReads.push(number);
        const page = Number(url.searchParams.get('page'));
        const perPage = Number(url.searchParams.get('per_page'));
        const all = issues.find((item) => item.number === number)?.comments ?? [];
        return Response.json(
          all
            .map((body, i) => ({ id: number * 1000 + i, body, user: { login: 'reviewer' } }))
            .slice((page - 1) * perPage, page * perPage),
          { headers: page * perPage < all.length ? { link: '<x>; rel="next"' } : {} },
        );
      }
      const issue = path.match(/^\/repos\/acme\/site\/issues\/(\d+)$/);
      if (issue && req.method === 'PATCH') {
        if (control.refuseIssueWrites)
          return Response.json(
            { message: 'Resource not accessible by personal access token' },
            { status: 403 },
          );
        const body = (await req.json()) as { state: string; state_reason?: string };
        stateChanges.push({
          number: Number(issue[1]),
          state: body.state,
          reason: body.state_reason,
        });
        return Response.json({ number: Number(issue[1]), state: body.state });
      }
      return Response.json({ message: 'Not Found' }, { status: 404 });
    },
  });
  return {
    baseUrl: `http://127.0.0.1:${server.port}`,
    hooks,
    issues,
    stateChanges,
    commentReads,
    commentWrites,
    accounts,
    goneComments,
    privateFiles,
    missingFiles,
    control,
    stop: () => server.stop(true),
  };
}

function githubIssue(issue: FakeIssue, stateReason: string | null = null) {
  return {
    number: issue.number,
    title: issue.title,
    body: issue.body,
    html_url: `https://github.example/acme/site/issues/${issue.number}`,
    state: issue.state,
    state_reason: stateReason,
    labels: issue.labels.map((name) => ({ name })),
    user: { login: 'contributor' },
    comments: issue.comments?.length ?? 0,
    ...(issue.pullRequest ? { pull_request: { url: 'x' } } : {}),
  };
}

interface Setup {
  asOwner: Api;
  webhookId: string;
  secret: string;
  repositoryId: number;
  columns: { id: number; stateType: string; name: string }[];
}

async function setup(fake: ReturnType<typeof fakeGithub>): Promise<Setup> {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  const created = await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  const connection = await asOwner
    .teams({ teamId: created.data!.teamId })
    .settings.git.connections.post({ provider: 'github', baseUrl: fake.baseUrl, token: 't' });
  const connected = await asOwner
    .projects({ projectKey: 'MKT' })
    .settings.git.connections({ connectionId: connection.data!.id })
    .repositories.post({ externalIds: ['1'] });
  const settings = (await asOwner.projects({ projectKey: 'MKT' }).settings.git.get()).data!;
  await asOwner.projects({ projectKey: 'MKT' }).settings.git.patch({ enabled: true });
  const view = (await asOwner.projects({ projectKey: 'MKT' }).get()).data!;
  return {
    asOwner,
    webhookId: settings.webhookId,
    secret: settings.secret,
    repositoryId: connected.data!.repositories[0]!.id,
    columns: view.columns,
  };
}

function repository(s: Setup) {
  return s.asOwner.projects({ projectKey: 'MKT' }).settings.git.repositories({
    repositoryId: s.repositoryId,
  });
}

async function deliver(s: Setup, event: string, payload: unknown) {
  const body = JSON.stringify(payload);
  const res = await app.handle(
    new Request(`http://localhost/webhooks/git/${s.webhookId}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-github-event': event,
        'x-hub-signature-256': `sha256=${createHmac('sha256', s.secret).update(body).digest('hex')}`,
        'x-github-delivery': crypto.randomUUID(),
      },
      body,
    }),
  );
  return (await res.json()) as { handled: string };
}

function issueEvent(
  action: string,
  issue: FakeIssue,
  extra: { stateReason?: string; changes?: object } = {},
) {
  return {
    action,
    issue: githubIssue(issue, extra.stateReason ?? null),
    repository: { full_name: 'acme/site' },
    ...(extra.changes ? { changes: extra.changes } : {}),
  };
}

async function boardIssues(asOwner: Api) {
  const res = await asOwner.projects({ projectKey: 'MKT' }).issues.get({ query: { limit: 500 } });
  return res.data!;
}

const opened: FakeIssue = {
  number: 7,
  title: 'Crash on start',
  body: 'Steps to reproduce',
  state: 'open',
  labels: ['bug', 'question'],
};

describe('Repository issue sync', () => {
  const environment = { ...process.env };
  let fake: ReturnType<typeof fakeGithub>;

  beforeEach(async () => {
    await resetDb();
    process.env.NODE_ENV = 'development';
    fake = fakeGithub();
  });

  afterEach(() => {
    fake.stop();
    process.env.NODE_ENV = environment.NODE_ENV;
  });

  it('subscribes the webhook to issue events only while the sync is on', async () => {
    const s = await setup(fake);
    expect([...fake.hooks.values()][0]!.events).not.toContain('issues');

    const on = await repository(s).patch({ issueSync: 'one_way' });
    expect(on.data).toMatchObject({ issueSync: 'one_way', status: 'connected' });
    expect([...fake.hooks.values()][0]!.events).toEqual(
      expect.arrayContaining(['issues', 'issue_comment', 'pull_request']),
    );

    await repository(s).patch({ issueSync: 'off' });
    expect([...fake.hooks.values()][0]!.events).not.toContain('issues');
  });

  it('creates an issue in the chosen column with the mapped labels', async () => {
    const s = await setup(fake);
    const started = s.columns.find((c) => c.stateType === 'started')!;
    const bug = (
      await s.asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'Bug', color: '#f00' })
    ).data!;
    await repository(s).patch({
      issueSync: 'one_way',
      issueColumnId: started.id,
      labelMappings: [{ externalName: 'bug', labelId: bug.id, typeId: null }],
    });

    expect(await deliver(s, 'issues', issueEvent('opened', opened))).toMatchObject({
      handled: 'issue',
    });

    const [created] = await boardIssues(s.asOwner);
    const detail = (await s.asOwner.issues({ issueId: created!.id }).get()).data!;
    expect(detail).toMatchObject({
      title: 'Crash on start',
      description: 'Steps to reproduce',
      columnId: started.id,
      labelIds: [bug.id],
    });
    expect(detail.repositoryIssue).toMatchObject({
      provider: 'github',
      repository: 'acme/site',
      number: 7,
      state: 'open',
    });
    const feed = (await s.asOwner.issues({ issueId: created!.id }).feed.get({ query: {} })).data!;
    expect(feed.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'created',
          actorName: 'contributor',
          actorSource: 'github',
        }),
      ]),
    );
  });

  it('notifies nobody a repository issue mentions', async () => {
    const s = await setup(fake);
    const member = await signUpTestUser();
    const invite = await s.asOwner
      .projects({ projectKey: 'MKT' })
      .invites.post({ email: member.email, role: 'member' });
    const asMember = authedApi(member.cookie);
    await asMember.invites({ token: invite.data!.token }).accept.post();
    await repository(s).patch({ issueSync: 'two_way' });
    const mention = { ...opened, body: `@${member.username} look at this` };

    await deliver(s, 'issues', issueEvent('opened', mention));
    await deliver(
      s,
      'issues',
      issueEvent(
        'edited',
        { ...mention, body: `@${member.username} again` },
        {
          changes: { body: { from: mention.body } },
        },
      ),
    );

    const inbox = await asMember.notifications.get({ query: { types: 'mentioned' } });
    expect(inbox.data!.items).toEqual([]);
    const [created] = await boardIssues(s.asOwner);
    const detail = (await s.asOwner.issues({ issueId: created!.id }).get()).data!;
    expect(detail.description).toBe(`@${member.username} again`);
  });

  it('sets the type of the first mapped label by name and keeps it when the label goes', async () => {
    const s = await setup(fake);
    const types = s.asOwner.projects({ projectKey: 'MKT' })['issue-types'];
    const bugType = (await types.post({ name: 'Bug' })).data!;
    const featureType = (await types.post({ name: 'Feature request' })).data!;
    await repository(s).patch({
      issueSync: 'two_way',
      labelMappings: [
        { externalName: 'bug', labelId: null, typeId: bugType.id },
        { externalName: 'enhancement', labelId: null, typeId: featureType.id },
      ],
    });

    await deliver(s, 'issues', issueEvent('opened', { ...opened, labels: ['enhancement', 'bug'] }));
    const [created] = await boardIssues(s.asOwner);
    const typeOf = async () =>
      (await s.asOwner.issues({ issueId: created!.id }).get()).data!.typeId;
    expect(await typeOf()).toBe(bugType.id);

    await deliver(s, 'issues', issueEvent('unlabeled', { ...opened, labels: ['enhancement'] }));
    expect(await typeOf()).toBe(featureType.id);
    await deliver(s, 'issues', issueEvent('unlabeled', { ...opened, labels: [] }));
    expect(await typeOf()).toBe(featureType.id);
  });

  it('refuses a type of another project', async () => {
    const s = await setup(fake);
    await createProject(s.asOwner, { key: 'OPS', name: 'Ops' });
    const type = (
      await s.asOwner.projects({ projectKey: 'OPS' })['issue-types'].post({ name: 'Bug' })
    ).data!;

    const res = await repository(s).patch({
      labelMappings: [{ externalName: 'bug', labelId: null, typeId: type.id }],
    });
    expect(res.status).toBe(400);
  });

  it('creates one issue when the same repository issue arrives twice', async () => {
    const s = await setup(fake);
    await repository(s).patch({ issueSync: 'one_way' });

    await deliver(s, 'issues', issueEvent('opened', opened));
    await deliver(s, 'issues', issueEvent('opened', opened));

    expect(await boardIssues(s.asOwner)).toHaveLength(1);
  });

  it('ignores issue events while the sync is off', async () => {
    const s = await setup(fake);

    expect(await deliver(s, 'issues', issueEvent('opened', opened))).toMatchObject({
      handled: 'ignored',
    });
    expect(await boardIssues(s.asOwner)).toHaveLength(0);
  });

  it('keeps one-way issues unchanged when the repository edits or closes them', async () => {
    const s = await setup(fake);
    await repository(s).patch({ issueSync: 'one_way' });
    await deliver(s, 'issues', issueEvent('opened', opened));

    const edited = { ...opened, title: 'Renamed', state: 'closed' as const };
    expect(await deliver(s, 'issues', issueEvent('closed', edited))).toMatchObject({
      handled: 'ignored',
    });
    const [issue] = await boardIssues(s.asOwner);
    expect(issue).toMatchObject({ title: 'Crash on start', columnId: s.columns[0]!.id });
  });

  it('copies two-way edits, label changes and state changes of the repository issue', async () => {
    const s = await setup(fake);
    const canceled = s.columns.find((c) => c.stateType === 'canceled')!;
    const labelsApi = s.asOwner.projects({ projectKey: 'MKT' }).labels;
    const bug = (await labelsApi.post({ name: 'Bug', color: '#f00' })).data!;
    const feature = (await labelsApi.post({ name: 'Feature', color: '#0f0' })).data!;
    const local = (await labelsApi.post({ name: 'Local', color: '#00f' })).data!;
    await repository(s).patch({
      issueSync: 'two_way',
      labelMappings: [
        { externalName: 'bug', labelId: bug.id, typeId: null },
        { externalName: 'enhancement', labelId: feature.id, typeId: null },
      ],
    });
    await deliver(s, 'issues', issueEvent('opened', opened));
    const [created] = await boardIssues(s.asOwner);
    await s.asOwner.issues({ issueId: created!.id }).patch({ labelIds: [bug.id, local.id] });

    await deliver(
      s,
      'issues',
      issueEvent(
        'edited',
        { ...opened, title: 'Crash on launch', body: 'ignored' },
        {
          changes: { title: { from: 'Crash on start' } },
        },
      ),
    );
    await deliver(s, 'issues', issueEvent('labeled', { ...opened, labels: ['enhancement'] }));
    let issue = (await s.asOwner.issues({ issueId: created!.id }).get()).data!;
    expect(issue).toMatchObject({ title: 'Crash on launch', description: 'Steps to reproduce' });
    expect([...issue.labelIds].sort()).toEqual([feature.id, local.id].sort());

    await deliver(s, 'issues', {
      ...issueEvent('closed', { ...opened, state: 'closed' }, { stateReason: 'not_planned' }),
      sender: { login: 'maintainer' },
    });
    issue = (await s.asOwner.issues({ issueId: created!.id }).get()).data!;
    expect(issue.columnId).toBe(canceled.id);
    expect(issue.repositoryIssue).toMatchObject({ state: 'closed' });
    // The move came from the repository, so nothing is sent back to it.
    expect(fake.stateChanges).toEqual([]);
    const history = await s.asOwner
      .issues({ issueId: created!.id })
      .feed.get({ query: { filter: 'history' } });
    expect(history.data!.items.find((item) => item.action === 'status')).toMatchObject({
      actorName: 'maintainer',
      actorSource: 'github',
    });

    await deliver(s, 'issues', issueEvent('reopened', opened));
    issue = (await s.asOwner.issues({ issueId: created!.id }).get()).data!;
    expect(issue.columnId).toBe(s.columns[0]!.id);
  });

  it('closes and reopens the repository issue when the issue changes state here', async () => {
    const s = await setup(fake);
    const done = s.columns.find((c) => c.stateType === 'completed')!;
    const canceled = s.columns.find((c) => c.stateType === 'canceled')!;
    await repository(s).patch({ issueSync: 'one_way' });
    await deliver(s, 'issues', issueEvent('opened', opened));
    const [created] = await boardIssues(s.asOwner);

    await s.asOwner.issues({ issueId: created!.id }).patch({ columnId: done.id });
    await s.asOwner.issues({ issueId: created!.id }).patch({ columnId: canceled.id });
    await s.asOwner.issues({ issueId: created!.id }).patch({ columnId: s.columns[0]!.id });

    expect(fake.stateChanges).toEqual([
      { number: 7, state: 'closed', reason: 'completed' },
      { number: 7, state: 'open', reason: undefined },
    ]);
  });

  it('shows on the repository a status change the provider refused, until one succeeds', async () => {
    const s = await setup(fake);
    const done = s.columns.find((c) => c.stateType === 'completed')!;
    await repository(s).patch({ issueSync: 'one_way' });
    await deliver(s, 'issues', issueEvent('opened', opened));
    const [created] = await boardIssues(s.asOwner);
    const repositoryState = async () => {
      const connections = await s.asOwner
        .projects({ projectKey: 'MKT' })
        .settings.git.connections.get();
      return connections.data![0]!.repositories[0]!;
    };

    fake.control.refuseIssueWrites = true;
    const moved = await s.asOwner.issues({ issueId: created!.id }).patch({ columnId: done.id });
    expect(moved.data).toMatchObject({ columnId: done.id });
    expect((await repositoryState()).lastError).toContain('acme/site#7');

    fake.control.refuseIssueWrites = false;
    await s.asOwner.issues({ issueId: created!.id }).patch({ columnId: s.columns[0]!.id });
    await s.asOwner.issues({ issueId: created!.id }).patch({ columnId: done.id });
    expect((await repositoryState()).lastError).toBeNull();
    expect(fake.stateChanges).toEqual([{ number: 7, state: 'closed', reason: 'completed' }]);
  });

  it('adds repository comments to the issue only when comment sync is on', async () => {
    const s = await setup(fake);
    await repository(s).patch({ issueSync: 'one_way' });
    await deliver(s, 'issues', issueEvent('opened', opened));
    const [created] = await boardIssues(s.asOwner);
    let nextId = 1;
    const comment = (body: string, pullRequest = false) => ({
      action: 'created',
      issue: githubIssue({ ...opened, pullRequest }),
      comment: { id: nextId++, body, user: { login: 'reviewer' } },
      repository: { full_name: 'acme/site' },
    });

    expect(await deliver(s, 'issue_comment', comment('Before'))).toMatchObject({
      handled: 'ignored',
    });
    await repository(s).patch({ issueComments: true });
    expect(await deliver(s, 'issue_comment', comment('Same here'))).toMatchObject({
      handled: 'comment',
    });
    expect(await deliver(s, 'issue_comment', comment('On a PR', true))).toMatchObject({
      handled: 'ignored',
    });

    const feed = (await s.asOwner.issues({ issueId: created!.id }).feed.get({ query: {} })).data!;
    const comments = feed.items.filter((item) => item.kind === 'comment');
    expect(comments).toMatchObject([
      { body: 'Same here', actorName: 'reviewer', actorSource: 'github' },
    ]);
  });

  it('imports open issues page by page and skips the ones already linked', async () => {
    const s = await setup(fake);
    await repository(s).patch({ issueSync: 'one_way' });
    for (let number = 1; number <= 52; number++)
      fake.issues.push({ number, title: `Issue ${number}`, body: '', state: 'open', labels: [] });
    fake.issues.push({
      number: 53,
      title: 'A PR',
      body: '',
      state: 'open',
      labels: [],
      pullRequest: true,
    });
    await deliver(s, 'issues', issueEvent('opened', fake.issues[0]!));

    const first = await repository(s).issues.import.post({});
    expect(first.data).toEqual({ created: 49, skipped: 1, nextPage: 2 });
    const second = await repository(s).issues.import.post({ page: 2 });
    expect(second.data).toEqual({ created: 2, skipped: 0, nextPage: null });
    const again = await repository(s).issues.import.post({});
    expect(again.data).toMatchObject({ created: 0, skipped: 50 });

    expect(await boardIssues(s.asOwner)).toHaveLength(52);
  });

  it('copies the comments of imported issues only while comment sync is on', async () => {
    const s = await setup(fake);
    await repository(s).patch({ issueSync: 'one_way' });
    const issue = (number: number, title: string, comments?: string[]): FakeIssue => ({
      number,
      title,
      body: '',
      state: 'open',
      labels: [],
      comments,
    });
    fake.issues.push(issue(1, 'Before', ['Early']));
    await repository(s).issues.import.post({});
    await repository(s).patch({ issueComments: true });
    const many = Array.from({ length: 101 }, (_, i) => `Comment ${i + 1}`);
    fake.issues.push(issue(2, 'Discussed', many), issue(3, 'Quiet'));

    const imported = await repository(s).issues.import.post({});
    expect(imported.data).toMatchObject({ created: 2, skipped: 1 });

    const commentsOf = async (title: string, order: 'asc' | 'desc' = 'asc') => {
      const found = (await boardIssues(s.asOwner)).find((item) => item.title === title)!;
      const feed = await s.asOwner
        .issues({ issueId: found.id })
        .feed.get({ query: { filter: 'comments', order, limit: 100 } });
      return feed.data!.items;
    };
    expect(await commentsOf('Before')).toEqual([]);
    const oldest = await commentsOf('Discussed');
    expect(oldest.map((item) => item.body)).toEqual(many.slice(0, 100));
    expect(oldest[0]).toMatchObject({ actorName: 'reviewer', actorSource: 'github' });
    expect((await commentsOf('Discussed', 'desc'))[0]).toMatchObject({ body: 'Comment 101' });
    expect(fake.commentReads).toEqual([2, 2]);
  });

  it('creates no issue when its comments cannot be read, so the next import copies both', async () => {
    const s = await setup(fake);
    await repository(s).patch({ issueSync: 'one_way', issueComments: true });
    fake.issues.push({
      number: 1,
      title: 'Discussed',
      body: '',
      state: 'open',
      labels: [],
      comments: ['First'],
    });
    fake.control.refuseCommentReads = true;

    expect((await repository(s).issues.import.post({})).status).toBe(502);
    expect(await boardIssues(s.asOwner)).toHaveLength(0);

    fake.control.refuseCommentReads = false;
    expect((await repository(s).issues.import.post({})).data).toMatchObject({ created: 1 });
    const [created] = await boardIssues(s.asOwner);
    const feed = (await s.asOwner.issues({ issueId: created!.id }).feed.get({ query: {} })).data!;
    expect(feed.items.filter((item) => item.kind === 'comment')).toMatchObject([{ body: 'First' }]);
  });

  describe('comments in two-way sync', () => {
    const repo = { full_name: 'acme/site' };
    const ownerGh = { id: 101, login: 'owner-gh' };
    const commentEvent = (
      action: string,
      id: number,
      body: string | null,
      user = { id: 2, login: 'reviewer' },
    ) => ({
      action,
      issue: githubIssue(opened),
      comment: { id, body, user },
      repository: repo,
      sender: { login: user.login },
    });

    async function linkedIssueId(s: Setup) {
      await repository(s).patch({ issueSync: 'two_way', issueComments: true });
      await deliver(s, 'issues', issueEvent('opened', opened));
      const [created] = await boardIssues(s.asOwner);
      return created!.id;
    }

    async function connectAccount(s: Setup) {
      fake.accounts['own-token'] = ownerGh;
      const res = await s.asOwner.account['git-accounts'].post({
        provider: 'github',
        baseUrl: fake.baseUrl,
        token: 'own-token',
      });
      expect(res.status).toBe(201);
    }

    async function comments(s: Setup, issueId: number) {
      const feed = await s.asOwner
        .issues({ issueId })
        .feed.get({ query: { filter: 'comments', order: 'asc' } });
      return feed.data!.items;
    }

    it("sends a comment written here under its author's account, with mentions kept quiet", async () => {
      const s = await setup(fake);
      const issueId = await linkedIssueId(s);
      await connectAccount(s);

      const posted = await s.asOwner
        .issues({ issueId })
        .comments.post({ body: 'Ping @someone, not `@code`' });

      expect(posted.status).toBe(201);
      const sent = 'Ping @&#8203;someone, not `@code`\n\n<!-- itsaplan -->';
      expect(fake.commentWrites).toEqual([
        { method: 'POST', id: 5000, body: sent, token: 'own-token' },
      ]);
      expect((await s.asOwner.issues({ issueId }).get()).data!.repositoryIssue).toMatchObject({
        pushComments: true,
        baseUrl: fake.baseUrl,
      });
      // The repository sends it back; it is not copied a second time.
      expect(
        await deliver(s, 'issue_comment', commentEvent('created', 5000, sent, ownerGh)),
      ).toMatchObject({ handled: 'ignored' });
      expect(await comments(s, issueId)).toMatchObject([
        {
          body: 'Ping @someone, not `@code`',
          repositoryComment: {
            provider: 'github',
            url: 'https://github.example/acme/site/issues/7#issuecomment-5000',
          },
        },
      ]);
    });

    it('keeps a comment here without an account, with the push off, or in one-way sync', async () => {
      const s = await setup(fake);
      const issueId = await linkedIssueId(s);

      await s.asOwner.issues({ issueId }).comments.post({ body: 'No account yet' });
      await connectAccount(s);
      await repository(s).patch({ issueCommentsPush: false });
      await s.asOwner.issues({ issueId }).comments.post({ body: 'Push off' });
      await repository(s).patch({ issueCommentsPush: true, issueSync: 'one_way' });
      await s.asOwner.issues({ issueId }).comments.post({ body: 'One way' });

      expect(fake.commentWrites).toEqual([]);
      expect((await s.asOwner.issues({ issueId }).get()).data!.repositoryIssue).toMatchObject({
        pushComments: false,
      });
    });

    it("edits and deletes the repository comment through its author's account", async () => {
      const s = await setup(fake);
      const issueId = await linkedIssueId(s);
      await connectAccount(s);
      const posted = await s.asOwner.issues({ issueId }).comments.post({ body: 'First' });
      const commentId = posted.data!.id;

      await s.asOwner.comments({ commentId }).patch({ body: 'Second' });
      const sent = 'Second\n\n<!-- itsaplan -->';
      // The edit comes back from the repository with the text sent and changes nothing.
      expect(
        await deliver(s, 'issue_comment', commentEvent('edited', 5000, sent, ownerGh)),
      ).toMatchObject({ handled: 'ignored' });
      await s.asOwner.comments({ commentId }).delete();

      expect(fake.commentWrites).toEqual([
        { method: 'POST', id: 5000, body: 'First\n\n<!-- itsaplan -->', token: 'own-token' },
        { method: 'PATCH', id: 5000, body: sent, token: 'own-token' },
        { method: 'DELETE', id: 5000, body: undefined, token: 'own-token' },
      ]);
      expect(await comments(s, issueId)).toEqual([]);
    });

    it('sends a file as its address on the host, or as its full address here', async () => {
      const s = await setup(fake);
      const issueId = await linkedIssueId(s);
      await connectAccount(s);
      const hostFile = `${fake.baseUrl}/user-attachments/assets/eeeeeeee-5555-4555-8555-555555555555`;
      await deliver(
        s,
        'issue_comment',
        commentEvent('created', 70, `![shot](${hostFile})`, ownerGh),
      );
      const [copied] = await comments(s, issueId);
      expect(copied!.body).toMatch(/^!\[shot\]\(\/media\/attachments\/[0-9a-f-]{36}\/raw\)$/);
      const local = `/media/attachments/${crypto.randomUUID()}/raw`;

      await s.asOwner
        .comments({ commentId: copied!.id })
        .patch({ body: `${copied!.body} ![mine](${local})` });

      const sent = `![shot](${hostFile}) ![mine](${process.env.APP_URL}${local})\n\n<!-- itsaplan -->`;
      expect(fake.commentWrites).toEqual([
        { method: 'PATCH', id: 70, body: sent, token: 'own-token' },
      ]);
      // The edit comes back from the repository with the text sent and changes nothing.
      expect(
        await deliver(s, 'issue_comment', commentEvent('edited', 70, sent, ownerGh)),
      ).toMatchObject({ handled: 'ignored' });
    });

    it('copies edits of a repository comment only in two-way sync', async () => {
      const s = await setup(fake);
      const issueId = await linkedIssueId(s);
      await deliver(s, 'issue_comment', commentEvent('created', 77, 'Typo'));

      expect(await deliver(s, 'issue_comment', commentEvent('edited', 77, 'Fixed'))).toMatchObject({
        handled: 'comment',
      });
      await repository(s).patch({ issueSync: 'one_way' });
      expect(await deliver(s, 'issue_comment', commentEvent('edited', 77, 'Again'))).toMatchObject({
        handled: 'ignored',
      });

      expect(await comments(s, issueId)).toMatchObject([
        { body: 'Fixed', actorName: 'reviewer', editedAt: expect.any(Date) },
      ]);
      expect(fake.commentWrites).toEqual([]);
    });

    it('keeps here a comment the repository deletes, with its replies, and stops syncing it', async () => {
      const s = await setup(fake);
      const issueId = await linkedIssueId(s);
      await connectAccount(s);
      await deliver(s, 'issue_comment', commentEvent('created', 78, 'Question', ownerGh));
      const [question] = await comments(s, issueId);
      await s.asOwner
        .issues({ issueId })
        .comments.post({ body: 'Answer', replyToId: question!.id });
      fake.commentWrites.length = 0;

      expect(await deliver(s, 'issue_comment', commentEvent('deleted', 78, null))).toMatchObject({
        handled: 'comment',
      });
      await s.asOwner.comments({ commentId: question!.id }).patch({ body: 'Question, edited' });
      await s.asOwner.comments({ commentId: question!.id }).delete();

      expect(await comments(s, issueId)).toMatchObject([{ body: 'Answer', replyToId: null }]);
      // The repository comment is gone, so neither the edit nor the delete goes there.
      expect(fake.commentWrites).toEqual([]);
      expect(await deliver(s, 'issue_comment', commentEvent('deleted', 78, null))).toMatchObject({
        handled: 'ignored',
      });
    });

    it('deletes a comment here that the repository deleted without telling', async () => {
      const s = await setup(fake);
      const issueId = await linkedIssueId(s);
      await connectAccount(s);
      const posted = await s.asOwner.issues({ issueId }).comments.post({ body: 'Gone there' });
      fake.goneComments.add(5000);

      const deleted = await s.asOwner.comments({ commentId: posted.data!.id }).delete();

      expect(deleted.status).toBeLessThan(300);
      expect(await comments(s, issueId)).toEqual([]);
      const connections = await s.asOwner
        .projects({ projectKey: 'MKT' })
        .settings.git.connections.get();
      expect(connections.data![0]!.repositories[0]!.lastError).toBeNull();
    });

    it('shows a repository comment as the member who connected its author', async () => {
      const s = await setup(fake);
      const issueId = await linkedIssueId(s);
      await connectAccount(s);

      await deliver(s, 'issue_comment', commentEvent('created', 88, 'Mine', ownerGh));

      const [comment] = await comments(s, issueId);
      expect(comment).toMatchObject({
        body: 'Mine',
        actorName: 'Owner',
        actorSource: 'github',
        repositoryComment: { url: 'https://github.example/acme/site/issues/7#issuecomment-88' },
      });
      expect(comment!.actorUserId).toBeString();
      expect(fake.commentWrites).toEqual([]);
    });

    it('shows a repository comment under its login once the login belongs to another account', async () => {
      const s = await setup(fake);
      const issueId = await linkedIssueId(s);
      await connectAccount(s);

      await deliver(
        s,
        'issue_comment',
        commentEvent('created', 90, 'Not me', { ...ownerGh, id: 999 }),
      );

      expect(await comments(s, issueId)).toMatchObject([
        { body: 'Not me', actorUserId: null, actorName: 'owner-gh' },
      ]);
    });

    it('keeps the replies of a comment deleted here, here and on the host', async () => {
      const s = await setup(fake);
      const issueId = await linkedIssueId(s);
      await connectAccount(s);
      const asMember = await addProjectMember(s.asOwner, 'MKT');
      fake.accounts['member-token'] = { id: 102, login: 'member-gh' };
      await asMember.account['git-accounts'].post({
        provider: 'github',
        baseUrl: fake.baseUrl,
        token: 'member-token',
      });
      const posted = await s.asOwner.issues({ issueId }).comments.post({ body: 'Question' });
      const commentId = posted.data!.id;
      await asMember.issues({ issueId }).comments.post({ body: 'Answer', replyToId: commentId });

      await s.asOwner.comments({ commentId }).delete();

      expect(fake.commentWrites.filter((write) => write.method === 'DELETE')).toEqual([
        { method: 'DELETE', id: 5000, body: undefined, token: 'own-token' },
      ]);
      expect(await comments(s, issueId)).toMatchObject([{ body: 'Answer', replyToId: null }]);
    });

    it('keeps on the host the comment of a member that the owner edits or deletes here', async () => {
      const s = await setup(fake);
      const issueId = await linkedIssueId(s);
      const asMember = await addProjectMember(s.asOwner, 'MKT');
      fake.accounts['member-token'] = { id: 102, login: 'member-gh' };
      await asMember.account['git-accounts'].post({
        provider: 'github',
        baseUrl: fake.baseUrl,
        token: 'member-token',
      });
      const posted = await asMember.issues({ issueId }).comments.post({ body: 'By member' });
      const commentId = posted.data!.id;

      expect((await s.asOwner.comments({ commentId }).patch({ body: 'By owner' })).status).toBe(
        200,
      );
      expect((await s.asOwner.comments({ commentId }).delete()).status).toBe(204);

      expect(fake.commentWrites).toEqual([
        { method: 'POST', id: 5000, body: 'By member\n\n<!-- itsaplan -->', token: 'member-token' },
      ]);
    });

    it('shows a repository comment under its host login when its account is outside the project', async () => {
      const s = await setup(fake);
      const issueId = await linkedIssueId(s);
      const outsider = authedApi((await signUpTestUser({ name: 'Outsider' })).cookie);
      fake.accounts['outsider-token'] = { id: 103, login: 'outsider-gh' };
      await outsider.account['git-accounts'].post({
        provider: 'github',
        baseUrl: fake.baseUrl,
        token: 'outsider-token',
      });

      await deliver(
        s,
        'issue_comment',
        commentEvent('created', 89, 'Hi', { id: 103, login: 'outsider-gh' }),
      );

      expect(await comments(s, issueId)).toMatchObject([
        { body: 'Hi', actorUserId: null, actorName: 'outsider-gh', actorSource: 'github' },
      ]);
    });
  });

  it('copies the files of a repository issue and its comments into attachments', async () => {
    const s = await setup(fake);
    await repository(s).patch({ issueSync: 'two_way', issueComments: true });
    const base = fake.baseUrl;
    const [shot, chart, gone, reply] = [
      'aaaaaaaa-1111-4111-8111-111111111111',
      'bbbbbbbb-2222-4222-8222-222222222222',
      'cccccccc-3333-4333-8333-333333333333',
      'dddddddd-4444-4444-8444-444444444444',
    ];
    fake.privateFiles.add(shot);
    fake.privateFiles.add(reply);
    fake.missingFiles.add(gone);
    const body = [
      `![screen shot](${base}/user-attachments/assets/${shot})`,
      `<img width="300" alt="chart" src="${base}/user-attachments/assets/${chart}" />`,
      `![lost](${base}/user-attachments/assets/${gone})`,
      '![elsewhere](https://example.com/x.png)',
    ].join('\n');

    await deliver(s, 'issues', issueEvent('opened', { ...opened, body }));
    const [created] = await boardIssues(s.asOwner);
    const issueApi = s.asOwner.issues({ issueId: created!.id });
    const files = async () => (await issueApi.attachments.get()).data!;
    const copied = await files();
    const urlOf = (name: string) => `/media${copied.find((file) => file.filename === name)!.url}`;

    expect(copied.map((file) => [file.filename, file.contentType]).sort()).toEqual([
      ['chart.gif', 'image/gif'],
      ['screen shot.png', 'image/png'],
    ]);
    const description = [
      `![screen shot](${urlOf('screen shot.png')})`,
      `<img width="300" alt="chart" src="${urlOf('chart.gif')}" />`,
      `![lost](${base}/user-attachments/assets/${gone})`,
      '![elsewhere](https://example.com/x.png)',
    ].join('\n');
    expect((await issueApi.get()).data!.description).toBe(description);

    // The same text synced again reuses the copies.
    await deliver(
      s,
      'issues',
      issueEvent('edited', { ...opened, body }, { changes: { body: { from: '' } } }),
    );
    expect(await files()).toHaveLength(2);
    expect((await issueApi.get()).data!.description).toBe(description);

    await deliver(s, 'issue_comment', {
      action: 'created',
      issue: githubIssue(opened),
      comment: {
        id: 61,
        body: `Fixed, see ![after](${base}/user-attachments/assets/${reply})`,
        user: { login: 'reviewer' },
      },
      repository: { full_name: 'acme/site' },
    });
    const after = (await files()).find((file) => file.filename === 'after.png')!;
    const feed = await issueApi.feed.get({ query: { filter: 'comments' } });
    expect(feed.data!.items).toMatchObject([{ body: `Fixed, see ![after](/media${after.url})` }]);
  });

  it('refuses an import while the sync is off', async () => {
    const s = await setup(fake);

    const res = await repository(s).issues.import.post({});
    expect(res.status).toBe(400);
  });

  it("lists the repository's labels with their mappings", async () => {
    const s = await setup(fake);
    const bug = (
      await s.asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'Bug', color: '#f00' })
    ).data!;
    await repository(s).patch({
      labelMappings: [{ externalName: 'removed', labelId: bug.id, typeId: null }],
    });

    const res = await repository(s).mapping.get();
    expect(res.data).toEqual({
      labels: [
        { name: 'bug', color: '#ee0701' },
        { name: 'enhancement', color: '#ee0701' },
        { name: 'removed', color: null },
      ],
      labelMappings: [{ externalName: 'removed', labelId: bug.id, typeId: null }],
    });
  });

  it('refuses a column or a label of another project', async () => {
    const s = await setup(fake);
    await createProject(s.asOwner, { key: 'OPS', name: 'Ops' });
    const other = (await s.asOwner.projects({ projectKey: 'OPS' }).get()).data!;
    const label = (
      await s.asOwner.projects({ projectKey: 'OPS' }).labels.post({ name: 'Bug', color: '#f00' })
    ).data!;

    expect((await repository(s).patch({ issueColumnId: other.columns[0]!.id })).status).toBe(400);
    expect(
      (
        await repository(s).patch({
          labelMappings: [{ externalName: 'bug', labelId: label.id, typeId: null }],
        })
      ).status,
    ).toBe(400);
  });

  it('closes the repository issue when its column is deleted into a closed one', async () => {
    const s = await setup(fake);
    const done = s.columns.find((c) => c.stateType === 'completed')!;
    const triage = (
      await s.asOwner
        .projects({ projectKey: 'MKT' })
        .columns.post({ name: 'Triage', stateType: 'backlog' })
    ).data!;
    await repository(s).patch({ issueSync: 'one_way', issueColumnId: triage.id });
    await deliver(s, 'issues', issueEvent('opened', opened));

    await s.asOwner
      .projects({ projectKey: 'MKT' })
      .columns({ columnId: triage.id })
      .delete({ mode: 'move', targetColumnId: done.id });

    expect(fake.stateChanges).toEqual([{ number: 7, state: 'closed', reason: 'completed' }]);
  });

  it('leaves the repository issue alone once its issue moves to another project', async () => {
    const s = await setup(fake);
    await createProject(s.asOwner, { key: 'OPS', name: 'Ops' });
    const ops = (await s.asOwner.projects({ projectKey: 'OPS' }).get()).data!;
    const opsDone = ops.columns.find((c) => c.stateType === 'completed')!;
    await repository(s).patch({ issueSync: 'two_way', issueComments: true });
    await deliver(s, 'issues', issueEvent('opened', opened));
    const [created] = await boardIssues(s.asOwner);

    await s.asOwner.issues({ issueId: created!.id }).move.post({ projectId: ops.project.id });
    await s.asOwner.issues({ issueId: created!.id }).patch({ columnId: opsDone.id });
    const edit = issueEvent('edited', { ...opened, title: 'Renamed' }, { changes: { title: {} } });
    const comment = {
      action: 'created',
      issue: githubIssue(opened),
      comment: { body: 'Still here?', user: { login: 'reviewer' } },
      repository: { full_name: 'acme/site' },
    };

    expect(await deliver(s, 'issues', edit)).toMatchObject({ handled: 'ignored' });
    expect(await deliver(s, 'issue_comment', comment)).toMatchObject({ handled: 'ignored' });
    expect(fake.stateChanges).toEqual([]);
    const detail = (await s.asOwner.issues({ issueId: created!.id }).get()).data!;
    expect(detail).toMatchObject({ title: opened.title, repositoryIssue: null });
  });

  it('adds a repository issue to a column at its hard WIP limit', async () => {
    const s = await setup(fake);
    const triage = (
      await s.asOwner
        .projects({ projectKey: 'MKT' })
        .columns.post({ name: 'Triage', stateType: 'backlog', wipLimit: 1, wipMode: 'hard' })
    ).data!;
    await repository(s).patch({ issueSync: 'one_way', issueColumnId: triage.id });

    await deliver(s, 'issues', issueEvent('opened', opened));
    await deliver(s, 'issues', issueEvent('opened', { ...opened, number: 8 }));

    const issues = await boardIssues(s.asOwner);
    expect(issues.filter((item) => item.columnId === triage.id)).toHaveLength(2);
  });

  it('starts no status agent run for imported issues, only for a new one', async () => {
    const s = await setup(fake);
    const agent = (
      await createAgent(s.asOwner, 'MKT', {
        name: 'Triage Bot',
        username: 'triage',
        kind: 'internal',
      })
    ).data!.agent;
    const schedules = s.asOwner.projects({ projectKey: 'MKT' })['agent-schedules'];
    const schedule = (
      await schedules.post({
        agentId: agent.id,
        name: 'Triage',
        type: 'status',
        columnId: s.columns[0]!.id,
      })
    ).data!;
    await repository(s).patch({ issueSync: 'one_way' });
    fake.issues.push({ ...opened, number: 1 }, { ...opened, number: 2 });

    await repository(s).issues.import.post({});
    const runs = async () => (await schedules({ scheduleId: schedule.id }).runs.get()).data!;
    expect(await runs()).toEqual([]);

    await deliver(s, 'issues', issueEvent('opened', { ...opened, number: 3 }));
    expect(await runs()).toHaveLength(1);
  });

  it('syncs nothing in either direction while the repository integration is off', async () => {
    const s = await setup(fake);
    const done = s.columns.find((c) => c.stateType === 'completed')!;
    await repository(s).patch({ issueSync: 'two_way' });
    await deliver(s, 'issues', issueEvent('opened', opened));
    const [created] = await boardIssues(s.asOwner);
    await s.asOwner.projects({ projectKey: 'MKT' }).settings.git.patch({ enabled: false });

    const res = await deliver(s, 'issues', issueEvent('opened', { ...opened, number: 8 }));
    await s.asOwner.issues({ issueId: created!.id }).patch({ columnId: done.id });

    expect(res).toMatchObject({ handled: 'disabled' });
    expect(await boardIssues(s.asOwner)).toHaveLength(1);
    expect(fake.stateChanges).toEqual([]);
    expect((await repository(s).issues.import.post({})).status).toBe(400);
  });

  it('stops reading labels from a server whose pages never end or never advance', async () => {
    const s = await setup(fake);

    fake.control.labelPages = 'endless';
    expect((await repository(s).mapping.get()).data!.labels).toHaveLength(1000);
    fake.control.labelPages = 'stuck';
    expect((await repository(s).mapping.get()).data!.labels).toHaveLength(50);
  });

  it('answers 404 for a repository of another project on every repository route', async () => {
    const s = await setup(fake);
    await createProject(s.asOwner, { key: 'OPS', name: 'Ops' });
    const elsewhere = s.asOwner
      .projects({ projectKey: 'OPS' })
      .settings.git.repositories({ repositoryId: s.repositoryId });

    expect((await elsewhere.patch({ issueSync: 'one_way' })).status).toBe(404);
    expect((await elsewhere.mapping.get()).status).toBe(404);
    expect((await elsewhere.issues.import.post({})).status).toBe(404);
  });

  it('refuses a label mapping or an import page outside the limits', async () => {
    const s = await setup(fake);
    const mapping = (externalName: string) => ({ externalName, labelId: null, typeId: null });
    await repository(s).patch({ issueSync: 'one_way' });

    expect((await repository(s).patch({ labelMappings: [mapping('')] })).status).toBe(400);
    expect((await repository(s).patch({ labelMappings: [mapping('x'.repeat(201))] })).status).toBe(
      400,
    );
    const many = Array.from({ length: 501 }, (_, i) => mapping(`label-${i}`));
    expect((await repository(s).patch({ labelMappings: many })).status).toBe(400);
    expect((await repository(s).patch({ labelMappings: many.slice(0, 500) })).status).toBe(200);
    expect((await repository(s).issues.import.post({ page: 0 })).status).toBe(400);
  });

  it('lets only a member who may edit repositories reach the repository routes', async () => {
    const s = await setup(fake);
    const outsider = authedApi((await signUpTestUser({ name: 'Outsider' })).cookie);
    const scope = outsider
      .projects({ projectKey: 'MKT' })
      .settings.git.repositories({ repositoryId: s.repositoryId });

    expect((await scope.patch({ issueSync: 'two_way' })).status).toBe(403);
    expect((await scope.mapping.get()).status).toBe(403);
    expect((await scope.issues.import.post({})).status).toBe(403);
  });
});
