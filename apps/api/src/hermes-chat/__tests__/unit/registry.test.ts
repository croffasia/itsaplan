import { describe, expect, it } from 'bun:test';
import { resolveHermesAgent } from '../../registry';

describe('Hermes agent registry', () => {
  it('resolves Bob to the fixed default profile and key variable', () => {
    expect(resolveHermesAgent('bob')).toEqual({
      slug: 'bob',
      profile: 'default',
      pathPrefix: '/p/default',
      apiKeyEnv: 'HERMES_BOB_API_KEY',
      enabled: true,
    });
  });

  it('rejects arbitrary agent and profile names', () => {
    expect(resolveHermesAgent('vexol-lead-sourcing')).toBeNull();
    expect(resolveHermesAgent('../default')).toBeNull();
    expect(resolveHermesAgent('scout')).toBeNull();
  });
});
