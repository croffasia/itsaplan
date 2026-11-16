import { afterEach, describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { getTool, integrationDescriptors, setExtraIntegrations } from '../registry';
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
