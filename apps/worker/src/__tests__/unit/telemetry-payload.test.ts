import { describe, expect, it } from 'bun:test';
import {
  bucket,
  buildPulse,
  failureRate,
  type InstanceCounts,
  type PulseInput,
} from '../../telemetry-payload';

describe('bucket', () => {
  it('reports zero and one exactly', () => {
    expect(bucket(0)).toBe('0');
    expect(bucket(1)).toBe('1');
  });

  it('reports a range for anything larger', () => {
    expect(bucket(2)).toBe('2-5');
    expect(bucket(5)).toBe('2-5');
    expect(bucket(6)).toBe('6-20');
    expect(bucket(100)).toBe('21-100');
    expect(bucket(101)).toBe('101-1000');
    expect(bucket(10_000)).toBe('1001-10000');
  });

  it('caps at the overflow bucket', () => {
    expect(bucket(10_001)).toBe('10000+');
    expect(bucket(5_000_000)).toBe('10000+');
  });

  it('treats a negative count as zero', () => {
    expect(bucket(-1)).toBe('0');
  });
});

describe('failureRate', () => {
  it('rounds to two decimals', () => {
    expect(failureRate(1, 3)).toBe(0.33);
    expect(failureRate(2, 8)).toBe(0.25);
  });

  it('is zero when nothing failed', () => {
    expect(failureRate(0, 10)).toBe(0);
  });

  it('is null when nothing ran, not zero', () => {
    expect(failureRate(0, 0)).toBeNull();
  });
});

const counts: InstanceCounts = {
  users: 7,
  activeUsers30d: 3,
  projects: 2,
  issues: 412,
  issuesCreated30d: 30,
  attachmentMb: 140,
  agents: 1,
  internalAgents: 1,
  externalAgents: 0,
  agentRuns30d: 20,
  agentRunsFailed30d: 5,
  agentSkills: 3,
  agentChats30d: 8,
  webhookDeliveries30d: 0,
  webhookDeliveriesFailed30d: 0,
  hasAgentSchedules: false,
  hasActiveRunners: false,
  runByMention30d: true,
  runByDelegation30d: false,
  runBySchedule30d: false,
  runByManual30d: true,
  hasWebhooks: false,
  hasApiKeys: false,
  hasMcpProject: true,
  hasEmail: true,
  hasGoogleOauth: false,
  hasTelegramBot: true,
  hasProjectIntegrations: true,
  hasGit: true,
};

const input: PulseInput = {
  instanceId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
  day: '2026-07-27',
  installedDay: '2026-07-10',
  version: '0.5.0',
  bunVersion: '1.3.14',
  docker: true,
  platform: 'linux/arm64',
  postgresMajor: 17,
  counts,
  features: { initiatives: true, noteBoards: false, cycles: true },
  featuresUsed30d: { initiatives: false, noteBoards: false, cycles: true },
  featuresDisabled: { initiatives: false, notes: true },
  integrationKeys: ['jina', 'openai'],
  gitProviders: ['github'],
  auth: { registration: 'invite', emailVerification: true, magicLink: false },
  locales: ['en', 'ru'],
};

describe('buildPulse', () => {
  it('reports counts as buckets, never as exact numbers', () => {
    const pulse = buildPulse(input);
    expect(pulse.scale).toEqual({
      users: '6-20',
      activeUsers30d: '2-5',
      projects: '2-5',
      issues: '101-1000',
      issuesCreated30d: '21-100',
      attachmentMb: '101-1000',
    });
    expect(JSON.stringify(pulse)).not.toContain('412');
  });

  it('carries the fields the collector stores in columns', () => {
    const pulse = buildPulse(input);
    expect(pulse.instanceId).toBe(input.instanceId);
    expect(pulse.day).toBe('2026-07-27');
    expect(pulse.version).toBe('0.5.0');
  });

  it('carries the install day, so an install is not inferred from the first pulse', () => {
    const pulse = buildPulse(input);
    expect(pulse.installedDay).toBe('2026-07-10');
    expect(buildPulse({ ...input, installedDay: null }).installedDay).toBeNull();
  });

  it('reports a failure rate only for what actually ran', () => {
    const pulse = buildPulse(input);
    expect(pulse.health.agentRunFailureRate30d).toBe(0.25);
    expect(pulse.health.webhookFailureRate30d).toBeNull();
  });

  it('reports features and integrations as booleans', () => {
    const pulse = buildPulse(input);
    expect(pulse.features.initiatives).toBe(true);
    expect(pulse.features.noteBoards).toBe(false);
    expect(pulse.integrations.telegramBot).toBe(true);
    expect(pulse.integrations.webhooks).toBe(false);
  });

  it('separates what was ever used from what was used in the last 30 days', () => {
    const pulse = buildPulse(input);
    expect(pulse.features.initiatives).toBe(true);
    expect(pulse.featuresUsed30d.initiatives).toBe(false);
    expect(pulse.featuresDisabled.notes).toBe(true);
  });

  it('carries catalogue identifiers, never what an operator typed', () => {
    const pulse = buildPulse(input);
    expect(pulse.integrationKeys).toEqual(['jina', 'openai']);
    expect(pulse.git).toEqual({ enabled: true, providers: ['github'] });
    expect(pulse.locales).toEqual(['en', 'ru']);
    expect(pulse.auth.registration).toBe('invite');
  });

  it('reports agent kinds and the triggers that started a run', () => {
    const pulse = buildPulse(input);
    expect(pulse.ai.internal).toBe('1');
    expect(pulse.ai.external).toBe('0');
    expect(pulse.ai.skills).toBe('2-5');
    expect(pulse.ai.triggers).toEqual({
      mention: true,
      delegation: false,
      schedule: false,
      manual: true,
    });
  });
});
