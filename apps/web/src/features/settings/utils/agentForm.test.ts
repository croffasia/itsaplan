import { describe, expect, it } from 'bun:test';
import { toUpdatePatch, type AgentFormValue } from './agentForm';

const externalAgent: AgentFormValue = {
  name: 'Bob',
  username: 'bob-agent',
  kind: 'external',
  modelCredentialId: 7,
  model: 'gpt-5-mini',
  instructions: 'Assist with this project.',
  tools: ['create_issue'],
  temperature: '0.2',
  maxSteps: '10',
  memoryEnabled: false,
  memoryLastMessages: '',
  triggerOnMention: false,
  triggerOnAssign: false,
  roleId: 3,
};

describe('agent form', () => {
  it('sends only authorization settings for an external agent', () => {
    expect(toUpdatePatch(externalAgent)).toEqual({ roleId: 3 });
  });
});
