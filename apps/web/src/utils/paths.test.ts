import { describe, expect, it } from 'bun:test';
import {
  agentsPath,
  isLeadsPath,
  leadsAgentRunsPath,
  leadsApprovalInboxPath,
  leadsLeadPath,
  leadsPath,
} from './paths';

describe('AI Team paths', () => {
  it('builds the project-scoped Agents route', () => {
    expect(agentsPath('VEX')).toBe('/project/VEX/ai-team/agents');
  });
});

describe('Leads paths', () => {
  it('builds project-scoped Leads routes', () => {
    expect(leadsPath('VEX')).toBe('/project/VEX/leads');
    expect(leadsApprovalInboxPath('VEX')).toBe('/project/VEX/leads/approval-inbox');
    expect(leadsAgentRunsPath('VEX')).toBe('/project/VEX/leads/agent-runs');
    expect(leadsLeadPath('VEX', 'lead-id')).toBe('/project/VEX/leads/lead-id');
  });

  it('keeps Leads active on every nested route without matching another section', () => {
    expect(isLeadsPath('/project/VEX/leads')).toBe(true);
    expect(isLeadsPath('/project/VEX/leads/approval-inbox')).toBe(true);
    expect(isLeadsPath('/project/VEX/leads/agent-runs')).toBe(true);
    expect(isLeadsPath('/project/VEX/leads/2eaa9e65-427a-420f-90c6-36d6de786bde')).toBe(true);
    expect(isLeadsPath('/project/VEX/accounting')).toBe(false);
  });
});
