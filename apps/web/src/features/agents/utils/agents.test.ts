import { describe, expect, it } from 'bun:test';
import type { AiAgent } from '@/lib/api';
import { filterAgents, isMainAssistant } from './agents';

const agent = (patch: Partial<AiAgent>): AiAgent => ({
  id: 1,
  projectId: 1,
  userId: 'user-1',
  name: 'Research agent',
  username: 'research-agent',
  kind: 'internal',
  modelCredentialId: 1,
  model: 'gpt-5',
  instructions: null,
  tools: [],
  temperature: null,
  maxSteps: null,
  memoryEnabled: false,
  memoryLastMessages: null,
  triggerOnMention: false,
  triggerOnAssign: false,
  roleId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  apiKeyStart: null,
  modelProvider: 'openai',
  actionCount: 2,
  skillCount: 1,
  toolCount: 1,
  ...patch,
});

describe('agent roster', () => {
  it('recognizes Bob as the main assistant', () => {
    expect(isMainAssistant(agent({ name: 'Bob', username: 'assistant' }))).toBe(true);
    expect(isMainAssistant(agent({ name: 'Assistant', username: 'bob-agent' }))).toBe(true);
  });

  it('places Bob first and filters by kind and search query', () => {
    const agents = [
      agent({ id: 2, name: 'Writer', username: 'writer' }),
      agent({ id: 3, name: 'Bob', username: 'bob-agent' }),
      agent({ id: 4, name: 'Webhook', username: 'webhook', kind: 'external', model: null }),
    ];

    expect(filterAgents(agents, 'all', '').map((item) => item.name)).toEqual([
      'Bob',
      'Webhook',
      'Writer',
    ]);
    expect(filterAgents(agents, 'external', '')).toHaveLength(1);
    expect(filterAgents(agents, 'all', 'gpt-5')).toHaveLength(2);
  });
});
