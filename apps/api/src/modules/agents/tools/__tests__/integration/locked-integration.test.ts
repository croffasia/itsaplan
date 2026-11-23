import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { lockedListing, setExtraIntegrations, type Integration } from '@repo/agent-tools';
import { authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent } from '#tests/helpers/agents';
import { agentToolSet } from '../../service';

// An integration another edition runs is listed locked: the catalog shows it with its
// tools, nothing of it can be added, and a tool kept from a time it ran keeps its name and
// goes to no agent.

const listing = lockedListing('exa');
const running: Integration = {
  ...listing,
  tools: listing.tools.map((tool) => ({
    ...tool,
    inputSchema: z.object({}),
    execute: async () => ({}),
  })),
};

const integrations = (api: Api, teamId: number) => api.teams({ teamId }).integrations;
const tools = (api: Api, teamId: number) => api.teams({ teamId })['agent-tools'];

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  const project = await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  return { asOwner, teamId: project.data!.teamId };
}

describe('a locked integration', () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterEach(() => setExtraIntegrations());

  it('is listed locked with its tools, and unlocked once an integration takes its key', async () => {
    const { asOwner, teamId } = await setup();
    const exa = async () =>
      (await integrations(asOwner, teamId).catalog.get()).data?.find((i) => i.key === 'exa');
    expect(await exa()).toMatchObject({
      kind: 'tool',
      label: 'Exa',
      locked: true,
      tools: expect.arrayContaining([expect.objectContaining({ key: 'exa_search' })]),
    });

    setExtraIntegrations([running]);
    expect((await exa())?.locked).toBeUndefined();
  });

  it('takes no credential and no tool', async () => {
    const { asOwner, teamId } = await setup();
    const credential = { integrationKey: 'exa', credential: { apiKey: 'exa-key' } };
    expect((await integrations(asOwner, teamId).post(credential)).status).toBe(400);
    expect((await integrations(asOwner, teamId).check.post(credential)).status).toBe(400);
    expect((await tools(asOwner, teamId).post({ toolKey: 'exa_search' })).status).toBe(400);
  });

  it('keeps a tool added while it ran, named, and gives it to no agent', async () => {
    const { asOwner, teamId } = await setup();
    setExtraIntegrations([running]);
    const credential = await integrations(asOwner, teamId).post({
      integrationKey: 'exa',
      credential: { apiKey: 'exa-key' },
    });
    const added = await tools(asOwner, teamId).post({
      toolKey: 'exa_search',
      credentialId: credential.data!.id,
    });
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
    });
    const agent = created.data!.agent;
    await asOwner
      .teams({ teamId })
      ['ai-agents']({ agentId: agent.id })
      ['tool-configs'].put({
        agentToolIds: [added.data!.id],
      });
    expect(await agentToolSet(agent)).toHaveLength(1);

    setExtraIntegrations();
    const list = await tools(asOwner, teamId).get({ query: { search: 'exa' } });
    expect(list.data?.items).toEqual([
      expect.objectContaining({
        label: 'Exa Search',
        integrationKey: 'exa',
        source: null,
        supported: false,
      }),
    ]);
    expect(await agentToolSet(agent)).toEqual([]);
  });
});
