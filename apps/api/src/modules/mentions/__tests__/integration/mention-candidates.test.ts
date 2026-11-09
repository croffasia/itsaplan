import { beforeEach, describe, expect, it } from 'bun:test';
import { authedApi, createProject, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent, setAgentProjectRole } from '#tests/helpers/agents';
import { createRole } from '#tests/helpers/roles';

// The "@" menu offers whoever a mention written at that place would reach, which the
// mention fan-out reads from the same rule.

interface Member {
  api: Api;
  userId: string;
  username: string;
}

async function setup() {
  const u = await signUpTestUser({ name: 'Owner' });
  const owner: Member = { api: authedApi(u.cookie), userId: u.userId, username: u.username };
  await createProject(owner.api, { key: 'MEN', name: 'Mentions' });
  return owner;
}

async function addMember(owner: Member, roleId?: number): Promise<Member> {
  const u = await signUpTestUser({ name: 'Member' });
  const invite = await owner.api
    .projects({ projectKey: 'MEN' })
    .invites.post({ email: u.email, role: 'member', roleId });
  const api = authedApi(u.cookie);
  await api.invites({ token: invite.data!.token }).accept.post();
  return { api, userId: u.userId, username: u.username };
}

async function addAgent(owner: Member, username: string, triggerOnMention = true) {
  return (
    await createAgent(owner.api, 'MEN', {
      name: username,
      username,
      kind: 'internal',
      triggerOnMention,
    })
  ).data!.agent;
}

const handles = (items: { username: string }[] | null) =>
  (items ?? []).map((item) => item.username).sort();

const onIssue = (member: Member, place: 'comment' | 'text') =>
  member.api.projects({ projectKey: 'MEN' })['mention-candidates'].get({ query: { place } });

const onDocument = (member: Member, documentId: number, place: 'comment' | 'text') =>
  member.api
    .projects({ projectKey: 'MEN' })
    .documents({ documentId })
    ['mention-candidates'].get({ query: { place } });

async function createDocument(member: Member, isPrivate = false) {
  return (
    await member.api
      .projects({ projectKey: 'MEN' })
      .documents.post({ title: 'Plan', content: 'Hello', isPrivate })
  ).data!.id;
}

describe('mention candidates', () => {
  beforeEach(resetDb);

  it('offers members and the agents that answer mentions in an issue comment', async () => {
    const owner = await setup();
    const member = await addMember(owner);
    await addAgent(owner, 'helper');
    await addAgent(owner, 'silent', false);

    const offered = await onIssue(owner, 'comment');
    expect(offered.status).toBe(200);
    expect(handles(offered.data)).toEqual(['helper', member.username].sort());
    expect(offered.data!.find((c) => c.username === 'helper')).toMatchObject({ kind: 'agent' });
  });

  it('offers an owner-scoped external agent only to the member it works for', async () => {
    const owner = await setup();
    const member = await addMember(owner);
    await createAgent(owner.api, 'MEN', {
      name: 'Mine',
      username: 'mine',
      kind: 'external',
      triggerOnMention: true,
      runnerScope: 'owner',
    });

    expect(handles((await onIssue(owner, 'comment')).data)).toEqual(
      ['mine', member.username].sort(),
    );
    expect(handles((await onIssue(member, 'comment')).data)).toEqual([owner.username]);
  });

  it('offers no agent in the text of an issue', async () => {
    const owner = await setup();
    const member = await addMember(owner);
    await addAgent(owner, 'helper');

    expect(handles((await onIssue(owner, 'text')).data)).toEqual([member.username]);
  });

  it('offers in a document comment only who may read documents, and agents that may comment', async () => {
    const owner = await setup();
    const reader = await addMember(owner);
    const boardOnly = await createRole(owner.api, 'MEN', {
      name: 'Board only',
      permissions: { work_items: { read: true } },
    });
    await addMember(owner, boardOnly.data!.id);
    await addAgent(owner, 'writer');
    const readOnly = await addAgent(owner, 'reader');
    const docsReader = await createRole(owner.api, 'MEN', {
      name: 'Docs reader',
      permissions: { documents: { read: true } },
    });
    await setAgentProjectRole(owner.api, 'MEN', readOnly.userId, docsReader.data!.id);
    const documentId = await createDocument(owner);

    const offered = await onDocument(owner, documentId, 'comment');
    expect(offered.status).toBe(200);
    expect(handles(offered.data)).toEqual([reader.username, 'writer'].sort());
    expect(handles((await onDocument(owner, documentId, 'text')).data)).toEqual([reader.username]);
  });

  it('offers nobody in a private document and hides it from everyone else', async () => {
    const owner = await setup();
    const member = await addMember(owner);
    await addAgent(owner, 'helper');
    const documentId = await createDocument(owner, true);

    const offered = await onDocument(owner, documentId, 'comment');
    expect(offered.status).toBe(200);
    expect(offered.data).toEqual([]);
    expect((await onDocument(member, documentId, 'comment')).status).toBe(404);
  });

  it('refuses a caller outside the project', async () => {
    const owner = await setup();
    const documentId = await createDocument(owner);
    const stranger = await signUpTestUser();
    const outsider: Member = {
      api: authedApi(stranger.cookie),
      userId: stranger.userId,
      username: stranger.username,
    };

    expect((await onIssue(outsider, 'comment')).status).toBe(403);
    expect((await onDocument(outsider, documentId, 'comment')).status).toBe(403);
  });
});
