import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IntegrationMeta } from '@/lib/api/endpoints/integrations';
import { matchingTools, toolIntegrations, toolSections } from './toolCatalog';

const tool = (key: string, label: string, group?: string) => ({
  key,
  label,
  description: `${label} description`,
  group,
});

const catalog: IntegrationMeta[] = [
  { key: 'openai', label: 'OpenAI', kind: 'llm', credentialSchema: [], tools: [] },
  { key: 'http', label: 'HTTP', kind: 'tool', credentialSchema: [], tools: [] },
  {
    key: 'github',
    label: 'GitHub',
    kind: 'tool',
    credentialSchema: [{ key: 'token', label: 'Token', type: 'secret', required: true }],
    tools: [
      tool('gh_list', 'GitHub List Issues', 'Issues'),
      tool('gh_talk', 'GitHub List Discussions', 'Discussions'),
      tool('gh_ping', 'Ping'),
      tool('gh_new', 'GitHub Create Issue', 'Issues'),
    ],
  },
];

describe('toolIntegrations', () => {
  it('keeps the tool integrations that offer a tool', () => {
    const [github, ...rest] = toolIntegrations(catalog);
    assert.equal(rest.length, 0);
    assert.equal(github.takesCredential, true);
    assert.equal(github.needsCredential, true);
    assert.deepEqual(
      github.tools.map((o) => o.name),
      ['List Issues', 'List Discussions', 'Ping', 'Create Issue'],
    );
  });
});

describe('matchingTools', () => {
  const [github] = toolIntegrations(catalog);

  it('filters by tool text', () => {
    assert.deepEqual(
      matchingTools(github, ' discuss ').map((o) => o.toolKey),
      ['gh_talk'],
    );
  });

  it('keeps every tool when the integration name matches', () => {
    assert.equal(matchingTools(github, 'github').length, 4);
    assert.equal(matchingTools(github, '').length, 4);
  });
});

describe('toolSections', () => {
  it('groups in catalog order with the ungrouped tools first', () => {
    const [github] = toolIntegrations(catalog);
    assert.deepEqual(
      toolSections(github.tools).map((s) => [s.group, s.tools.map((o) => o.toolKey)]),
      [
        [null, ['gh_ping']],
        ['Issues', ['gh_list', 'gh_new']],
        ['Discussions', ['gh_talk']],
      ],
    );
  });
});
