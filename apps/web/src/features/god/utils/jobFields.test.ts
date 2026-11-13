import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { JobSettings } from '@/lib/api/endpoints/god';
import { jobFormValid, jobValue, leaseTooShort, toJobForm, toJobSettings } from './jobFields';

const settings: JobSettings = {
  webhooks: {
    pollIntervalMs: 2000,
    batchSize: 20,
    timeoutMs: 10_000,
    maxAttempts: 8,
    disableThreshold: 20,
    leaseSeconds: 120,
    retentionDays: 30,
    cleanupIntervalMinutes: 10,
  },
  notifications: { batchSize: 20, maxAttempts: 5, leaseSeconds: 120 },
  imports: { pollIntervalMs: 3000 },
  agentRuns: { pollIntervalMs: 2000, maxAttempts: 3, leaseSeconds: 300 },
  agentChat: {
    leaseSeconds: 300,
    maxAttempts: 3,
    claimWaitMs: 25_000,
    claimPollMs: 500,
    streamPollMs: 300,
    historyMessages: 20,
  },
  agentInvocations: { pollIntervalMs: 1000, timeoutMs: 15_000 },
  sweeps: { autoArchiveMinutes: 60, tracePruneMinutes: 60, shareExpiryMinutes: 1 },
  bot: { configPollIntervalMs: 30_000 },
};

describe('job settings form', () => {
  it('round-trips the settings through the form', () => {
    const form = toJobForm(settings);
    assert.equal(form['webhooks.timeoutMs'], '10000');
    assert.ok(jobFormValid(form));
    assert.deepEqual(toJobSettings(form), settings);
  });

  it('rejects empty, fractional and out-of-range values', () => {
    const form = toJobForm(settings);
    for (const value of ['', '1.5', '99', '600001']) {
      const next = { ...form, 'webhooks.pollIntervalMs': value };
      assert.ok(Number.isNaN(jobValue(next, 'webhooks.pollIntervalMs')), value);
      assert.equal(jobFormValid(next), false, value);
    }
  });

  it('flags a lease that is not longer than its timeout', () => {
    const form = toJobForm(settings);
    assert.equal(leaseTooShort(form, 'webhooks.leaseSeconds', 'webhooks.timeoutMs'), false);
    const short = { ...form, 'webhooks.leaseSeconds': '10' };
    assert.equal(leaseTooShort(short, 'webhooks.leaseSeconds', 'webhooks.timeoutMs'), true);
    const empty = { ...form, 'webhooks.leaseSeconds': '' };
    assert.equal(leaseTooShort(empty, 'webhooks.leaseSeconds', 'webhooks.timeoutMs'), false);
  });
});
