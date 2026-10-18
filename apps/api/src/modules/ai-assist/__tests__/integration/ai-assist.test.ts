import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { allowLocalModel, createCredential } from '#tests/helpers/integrations';
import { AI_ASSIST_CALLS_PER_HOUR } from '../../rate-limit';

// An OpenAI-compatible endpoint that answers every call with `answer`.
let answer = '';

function reply(stream: boolean): Response {
  if (!stream) {
    return Response.json({
      id: 'x',
      object: 'chat.completion',
      created: 0,
      model: 'm',
      choices: [
        { index: 0, finish_reason: 'stop', message: { role: 'assistant', content: answer } },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
  }
  const chunk = (choice: object) =>
    `data: ${JSON.stringify({ id: 'x', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, ...choice }] })}\n\n`;
  const body =
    chunk({ delta: { role: 'assistant', content: answer } }) +
    chunk({ delta: {}, finish_reason: 'stop' });
  return new Response(`${body}data: [DONE]\n\n`, {
    headers: { 'content-type': 'text/event-stream' },
  });
}

describe('ai assist', () => {
  let endpoint: ReturnType<typeof Bun.serve>;
  let disallow: () => void;

  beforeEach(async () => {
    await resetDb();
    endpoint = Bun.serve({
      port: 0,
      fetch: async (req) => reply(Boolean(((await req.json()) as { stream?: boolean }).stream)),
    });
    disallow = allowLocalModel(`http://localhost:${endpoint.port}`);
  });

  afterEach(async () => {
    disallow();
    await endpoint.stop(true);
  });

  async function setup(configure = true) {
    const owner = await signUpTestUser({ name: 'Owner' });
    const api = authedApi(owner.cookie);
    await createProject(api, { key: 'MKT', name: 'Marketing' });
    const view = (await api.projects({ projectKey: 'MKT' }).get()).data!;
    const credentialId = await createCredential(api, 'MKT', {
      integrationKey: 'openai-compatible',
      credential: { apiKey: 'sk-test', baseUrl: `http://localhost:${endpoint.port}/v1` },
    });
    if (configure) {
      const res = await api
        .teams({ teamId: view.project.teamId })
        ['ai-assist'].put({ credentialId, model: 'any-model' });
      expect(res.status).toBe(200);
    }
    return { api, view, credentialId };
  }

  it('answers 409 while the team has picked no model', async () => {
    const { api } = await setup(false);
    expect((await api.projects({ projectKey: 'MKT' }).ai.get()).data).toEqual({ enabled: false });
    const res = await api.projects({ projectKey: 'MKT' }).ai.board.post({ prompt: 'a launch' });
    expect(res.status).toBe(409);
  });

  it('refuses a credential of another kind or team', async () => {
    const { api, view } = await setup(false);
    const res = await api
      .teams({ teamId: view.project.teamId })
      ['ai-assist'].put({ credentialId: 999999, model: 'm' });
    expect(res.status).toBe(400);
  });

  it('drafts a board without writing, then creates the confirmed draft', async () => {
    const { api, view } = await setup();
    answer =
      'Here it is:\n' +
      JSON.stringify({
        columns: [
          { name: 'Ideas', stateType: 'backlog' },
          { name: 'Writing', stateType: 'started' },
          { name: 'Odd', stateType: 'nonsense' },
        ],
        issues: [
          { title: 'Draft the post by Friday', description: 'Long form', column: 'Writing' },
          { title: 'Pick a topic', description: '', column: 'Missing', dueDate: '2030-01-02' },
        ],
      });
    const draft = await api.projects({ projectKey: 'MKT' }).ai.board.post({ prompt: 'a blog' });
    expect(draft.status).toBe(200);
    expect(draft.data!.columns[2].stateType).toBe('unstarted');
    expect(draft.data!.issues[0].dueDate).not.toBeNull();
    expect(new Date(draft.data!.issues[1].dueDate!).getTime()).toBe(
      new Date('2030-01-02').getTime(),
    );
    const before = (await api.projects({ projectKey: 'MKT' }).get()).data!;
    expect(before.columns.length).toBe(view.columns.length);

    // Eden turns a date string of the response into a Date; the web client sends it back as text.
    const confirmed = {
      ...draft.data!,
      issues: draft.data!.issues.map((i) => ({
        ...i,
        dueDate: i.dueDate && new Date(i.dueDate).toISOString().slice(0, 10),
      })),
    };
    const applied = await api.projects({ projectKey: 'MKT' }).ai.board.apply.post(confirmed);
    expect(applied.status).toBe(201);
    expect(applied.data).toEqual({ columns: 3, issues: 2 });
    const after = (await api.projects({ projectKey: 'MKT' }).get()).data!;
    const issues = (await api.projects({ projectKey: 'MKT' }).issues.get({ query: {} })).data!;
    const writing = after.columns.find((c) => c.name === 'Writing')!;
    const ideas = after.columns.find((c) => c.name === 'Ideas')!;
    const post = issues.find((i) => i.title === 'Draft the post by Friday')!;
    expect(post.columnId).toBe(writing.id);
    expect(issues.find((i) => i.title === 'Pick a topic')!.columnId).toBe(ideas.id);
  });

  it('answers 502 when the model does not answer with JSON', async () => {
    const { api } = await setup();
    answer = 'Sorry, I cannot.';
    const res = await api.projects({ projectKey: 'MKT' }).ai.board.post({ prompt: 'x' });
    expect(res.status).toBe(502);
  });

  it('reads a due date from the title of a new issue', async () => {
    const { api, view } = await setup(false);
    const issue = await api
      .projects({ projectKey: 'MKT' })
      .issues.post({ columnId: view.columns[0].id, title: 'Renew the domain on 2031-05-04' });
    expect(new Date(issue.data!.dueDate!).getTime()).toBe(new Date('2031-05-04').getTime());
  });

  it('suggests a checklist and adds it once confirmed', async () => {
    const { api, view } = await setup();
    const issue = (
      await api
        .projects({ projectKey: 'MKT' })
        .issues.post({ columnId: view.columns[0].id, title: 'Launch the newsletter' })
    ).data!;
    answer = JSON.stringify({ title: 'Launch', items: ['Write copy', 'Pick a list', ''] });
    const draft = await api.issues({ issueId: issue.id }).ai.checklist.post();
    expect(draft.data).toEqual({ title: 'Launch', items: ['Write copy', 'Pick a list'] });
    expect((await api.issues({ issueId: issue.id }).checklists.get()).data).toEqual([]);

    const applied = await api.issues({ issueId: issue.id }).ai.checklist.apply.post(draft.data!);
    expect(applied.status).toBe(201);
    expect(applied.data!.items.map((i) => i.content)).toEqual(['Write copy', 'Pick a list']);
  });

  it('answers 429 once a person has used up the hourly drafts', async () => {
    const { api } = await setup();
    answer = JSON.stringify({ columns: [], issues: [] });
    for (let i = 0; i < AI_ASSIST_CALLS_PER_HOUR; i++) {
      await api.projects({ projectKey: 'MKT' }).ai.board.post({ prompt: 'x' });
    }
    const res = await api.projects({ projectKey: 'MKT' }).ai.board.post({ prompt: 'x' });
    expect(res.status).toBe(429);
    expect(res.error?.value).toMatchObject({ error: expect.stringContaining('per hour') });
  });
});
