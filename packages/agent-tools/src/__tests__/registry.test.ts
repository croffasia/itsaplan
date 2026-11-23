import { afterEach, describe, expect, it } from 'bun:test';
import { z } from 'zod';
import {
  INTEGRATIONS,
  LOCKED_INTEGRATIONS,
  getLockedTool,
  getTool,
  integrationDescriptors,
  lockedListing,
  setExtraIntegrations,
} from '../registry';
import type { Integration } from '../types';

const extra: Integration = {
  key: 'extra',
  label: 'Extra',
  credentialSchema: [],
  tools: [
    {
      key: 'extra_echo',
      label: 'Echo',
      description: 'Returns its input.',
      inputSchema: z.object({}),
      execute: async (_credential, input) => input,
    },
  ],
};

// The interface shows the description under the integration's name.
it('describes every core integration', () => {
  expect(integrationDescriptors().filter((d) => !d.description?.trim())).toEqual([]);
});

describe('setExtraIntegrations', () => {
  afterEach(() => setExtraIntegrations());

  it('adds integrations beside the core ones and removes them again', () => {
    setExtraIntegrations([extra]);
    expect(getTool('extra_echo')?.integration.key).toBe('extra');
    expect(integrationDescriptors().map((d) => d.key)).toEqual(
      expect.arrayContaining(['jina', 'extra']),
    );

    setExtraIntegrations();
    expect(getTool('extra_echo')).toBeUndefined();
    expect(getTool('jina_reader')).toBeDefined();
  });

  it('refuses a taken key and keeps the previous set', () => {
    setExtraIntegrations([extra]);
    expect(() => setExtraIntegrations([{ ...extra, key: 'jina' }])).toThrow(
      'Duplicate integration key',
    );
    expect(() =>
      setExtraIntegrations([{ ...extra, tools: [{ ...extra.tools[0], key: 'jina_reader' }] }]),
    ).toThrow('Duplicate tool key');
    expect(getTool('extra_echo')).toBeDefined();
  });
});

describe('locked integrations', () => {
  afterEach(() => setExtraIntegrations());

  const listing = lockedListing('exa');
  const running: Integration = {
    ...listing,
    tools: listing.tools.map((tool) => ({
      ...tool,
      inputSchema: z.object({}),
      execute: async () => ({}),
    })),
  };

  it('lists one locked, with no tool to run, until an integration takes its key', () => {
    const descriptor = () => integrationDescriptors().find((d) => d.key === 'exa');
    expect(descriptor()).toMatchObject({ kind: 'tool', locked: true, label: 'Exa' });
    expect(getTool('exa_search')).toBeUndefined();
    expect(getLockedTool('exa_search')?.tool.label).toBe('Exa Search');

    setExtraIntegrations([running]);
    expect(descriptor()?.locked).toBeUndefined();
    expect(integrationDescriptors().filter((d) => d.key === 'exa')).toHaveLength(1);
    expect(getTool('exa_search')?.integration.key).toBe('exa');
    expect(getLockedTool('exa_search')).toBeUndefined();

    setExtraIntegrations();
    expect(descriptor()?.locked).toBe(true);
  });

  it('refuses a key it does not list', () => {
    expect(() => lockedListing('nope')).toThrow('No locked integration "nope".');
  });

  // A listing the core runs itself would never show, and a tool key it shares would name
  // the wrong tool.
  it('takes no key of a core integration or tool', () => {
    const keys = new Set(INTEGRATIONS.map((i) => i.key));
    const tools = new Set(INTEGRATIONS.flatMap((i) => i.tools.map((t) => t.key)));
    for (const locked of LOCKED_INTEGRATIONS) {
      expect(keys.has(locked.key)).toBe(false);
      expect(locked.tools.filter((t) => tools.has(t.key))).toEqual([]);
    }
  });
});
