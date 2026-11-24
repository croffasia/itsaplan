import { beforeEach, describe, expect, it } from 'bun:test';
import { db, notificationDelivery } from '@repo/db';
import { authedApi, createProject, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// A project follows the user's defaults until it has settings of its own. Both are the
// session user's alone.

const none = {
  assigned: false,
  mentioned: false,
  commented: false,
  state_changed: false,
  reacted: false,
};
const off = { emailEvents: none, telegramEvents: none, slackEvents: none, pushEvents: none };
const email = (...events: (keyof typeof none)[]) => ({
  ...off,
  emailEvents: { ...none, ...Object.fromEntries(events.map((event) => [event, true])) },
});

const account = (api: Api) => api.account['notification-preferences'];
const ofProject = (api: Api, projectKey: string) =>
  api.projects({ projectKey })['notification-preferences'];

async function setup() {
  const user = await signUpTestUser();
  const api = authedApi(user.cookie);
  const marketing = (await createProject(api, { key: 'MKT', name: 'Marketing' })).data!;
  const website = (await createProject(api, { key: 'WEB', name: 'Website' })).data!;
  return { api, teamId: website.teamId, marketingId: marketing.id, websiteId: website.id };
}

// Someone else, invited to MKT.
async function addMember(api: Api) {
  const member = await signUpTestUser();
  const memberApi = authedApi(member.cookie);
  const invite = await api
    .projects({ projectKey: 'MKT' })
    .invites.post({ email: member.email, role: 'member' });
  await memberApi.invites({ token: invite.data!.token }).accept.post();
  return { ...member, api: memberApi };
}

// The own settings of each project by its name, null where it follows the defaults.
async function own(api: Api) {
  const { projects } = (await account(api).get()).data!;
  return Object.fromEntries(projects.map((p) => [p.name, p.preferences]));
}

beforeEach(resetDb);

describe('account notification preferences', () => {
  it('start with everything off and every project on the defaults', async () => {
    const { api, marketingId } = await setup();

    const res = await account(api).get();

    expect(res.status).toBe(200);
    expect(res.data!.defaults).toEqual(off);
    expect(res.data!.projects.map((p) => p.name)).toEqual(['Marketing', 'Website']);
    expect(res.data!.projects[0]).toMatchObject({
      id: marketingId,
      slackTeamId: null,
      preferences: null,
    });
    expect((await ofProject(api, 'MKT').get()).data).toEqual(off);
  });

  it('list a hidden project, and leave out an archived one and those of other people', async () => {
    const { api, teamId, websiteId } = await setup();
    const other = authedApi((await signUpTestUser()).cookie);
    await createProject(other, { key: 'OTH', name: 'Other' });
    await api.projects({ projectKey: 'MKT' }).preferences.patch({ isHidden: true });
    await api.teams({ teamId }).projects({ projectId: websiteId }).archive.post();

    expect(await own(api)).toEqual({ Marketing: null });
    expect(await own(other)).toEqual({ Other: null });
  });

  it('a project follows the defaults until it has settings of its own', async () => {
    const { api, marketingId } = await setup();

    const saved = await account(api).patch({
      defaults: email('assigned', 'mentioned'),
      projects: [{ projectId: marketingId, preferences: email('commented') }],
    });

    expect(saved.status).toBe(204);
    expect((await account(api).get()).data!.defaults).toEqual(email('assigned', 'mentioned'));
    expect(await own(api)).toEqual({ Marketing: email('commented'), Website: null });
    expect((await ofProject(api, 'MKT').get()).data).toEqual(email('commented'));
    expect((await ofProject(api, 'WEB').get()).data).toEqual(email('assigned', 'mentioned'));
  });

  it('replace the settings of several projects and return them to the defaults', async () => {
    const { api, marketingId, websiteId } = await setup();
    await account(api).patch({
      projects: [
        { projectId: marketingId, preferences: email('commented') },
        { projectId: websiteId, preferences: email('reacted') },
      ],
    });

    await account(api).patch({
      projects: [
        { projectId: marketingId, preferences: null },
        { projectId: websiteId, preferences: off },
      ],
    });

    expect(await own(api)).toEqual({ Marketing: null, Website: off });
  });

  it('return every project to the defaults, an archived one and one the user left included', async () => {
    const { api, teamId, marketingId, websiteId } = await setup();
    const member = await addMember(api);
    const asMember = { userId: member.userId, role: 'member' as const };
    await api.projects({ projectKey: 'WEB' }).members.post(asMember);
    await account(member.api).patch({
      projects: [
        { projectId: marketingId, preferences: email('commented') },
        { projectId: websiteId, preferences: email('reacted') },
      ],
    });
    const { members } = api.projects({ projectKey: 'MKT' });
    const website = api.teams({ teamId }).projects({ projectId: websiteId });
    await members({ userId: member.userId }).delete();
    await website.archive.post();

    const res = await account(member.api).patch({ resetProjects: true });

    expect(res.status).toBe(204);
    await members.post(asMember);
    await website.restore.post();
    expect(await own(member.api)).toEqual({ Marketing: null, Website: null });
  });

  it('take the last settings of a project listed twice', async () => {
    const { api, marketingId } = await setup();

    const res = await account(api).patch({
      projects: [
        { projectId: marketingId, preferences: email('commented') },
        { projectId: marketingId, preferences: email('mentioned') },
      ],
    });

    expect(res.status).toBe(204);
    expect((await own(api)).Marketing).toEqual(email('mentioned'));
  });

  it('change nothing when one of the projects is not the user’s', async () => {
    const { api, marketingId } = await setup();
    const other = authedApi((await signUpTestUser()).cookie);

    const res = await account(other).patch({
      defaults: email('assigned'),
      projects: [{ projectId: marketingId, preferences: email('commented') }],
    });

    expect(res.status).toBe(403);
    expect((await account(other).get()).data!.defaults).toEqual(off);
    expect((await own(api)).Marketing).toBeNull();
  });

  it('are refused for an archived project', async () => {
    const { api, teamId, marketingId } = await setup();
    await api.teams({ teamId }).projects({ projectId: marketingId }).archive.post();

    const res = await account(api).patch({
      projects: [{ projectId: marketingId, preferences: off }],
    });

    expect(res.status).toBe(403);
  });

  it('refuse a set that leaves a channel out', async () => {
    const { api } = await setup();

    const res = await account(api).patch({ defaults: { emailEvents: none } as never });

    expect(res.status).toBe(400);
  });
});

describe('project notification preferences', () => {
  it('keep what the defaults send on a channel the write leaves out', async () => {
    const { api } = await setup();
    const defaults = { ...off, slackEvents: { ...none, mentioned: true } };
    await account(api).patch({ defaults });

    const res = await ofProject(api, 'MKT').put({
      emailEvents: { ...none, assigned: true },
      telegramEvents: none,
    });

    expect(res.data).toEqual({ ...defaults, emailEvents: { ...none, assigned: true } });
    expect((await own(api)).Marketing).toEqual(res.data!);
  });
});

describe('delivery', () => {
  // The emails queued for someone assigned an issue in MKT, by address.
  async function emailed(prepare: (member: Api, projectId: number) => Promise<unknown>) {
    const { api, marketingId } = await setup();
    const member = await addMember(api);
    const project = api.projects({ projectKey: 'MKT' });
    const view = (await project.get()).data!;
    await api.teams({ teamId: view.project.teamId })['notification-settings'].put({
      smtp: {
        enabled: true,
        host: 'smtp.example.com',
        port: 587,
        encryption: 'none',
        username: 'mailer@example.com',
        password: 'secret',
        timeout: null,
      },
    });
    await prepare(member.api, marketingId);
    await project.issues.post({
      columnId: view.columns[0]!.id,
      title: 'Task',
      assigneeUserId: member.userId,
    });
    // No route reads the outbox, and its rows are what the worker sends.
    const rows = await db
      .select({ recipient: notificationDelivery.recipient })
      .from(notificationDelivery);
    return { address: member.email, recipients: rows.map((row) => row.recipient) };
  }

  it('follows the defaults in a project joined after they were set', async () => {
    const { address, recipients } = await emailed((member) =>
      account(member).patch({ defaults: email('assigned') }),
    );

    expect(recipients).toEqual([address]);
  });

  it('follows the project’s own settings over the defaults', async () => {
    const { recipients } = await emailed((member, projectId) =>
      account(member).patch({
        defaults: email('assigned'),
        projects: [{ projectId, preferences: off }],
      }),
    );

    expect(recipients).toEqual([]);
  });

  it('sends nothing to someone who set neither', async () => {
    const { recipients } = await emailed(async () => {});

    expect(recipients).toEqual([]);
  });
});
