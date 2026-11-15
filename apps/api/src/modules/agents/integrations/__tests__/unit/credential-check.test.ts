import { afterEach, describe, expect, it } from 'bun:test';
import { setExtraIntegrations, type Integration } from '@repo/agent-tools';
import { askService } from '../../credential-check';

// A service an extension adds, with the check it brings or none.
const service = (verify?: Integration['verify']): Integration => ({
  key: 'svc_bearer',
  label: 'Service',
  kind: 'service',
  credentialSchema: [],
  tools: [],
  verify,
});

describe('askService', () => {
  afterEach(() => setExtraIntegrations());

  it('checks a service an extension adds with its own verify, not as an AI provider', async () => {
    setExtraIntegrations([service(async () => 'valid')]);
    expect(await askService('svc_bearer', { baseUrl: 'https://svc.test' })).toBe('valid');
  });

  it('cannot check a service that brings no verify', async () => {
    setExtraIntegrations([service()]);
    expect(await askService('svc_bearer', { baseUrl: 'https://svc.test' })).toBe('unknown');
  });
});
