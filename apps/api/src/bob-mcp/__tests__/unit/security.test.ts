import { describe, expect, it } from 'bun:test';
import {
  constantTimeTokenMatches,
  createAuditEvent,
  sanitizeErrorCode,
  withTimeout,
} from '../../security';

describe('Bob MCP security helpers', () => {
  it('compares bearer tokens without returning token details', () => {
    expect(constantTimeTokenMatches('safe-test-token', 'safe-test-token')).toBe(true);
    expect(constantTimeTokenMatches('wrong', 'safe-test-token')).toBe(false);
    expect(constantTimeTokenMatches('', 'safe-test-token')).toBe(false);
  });

  it('creates an audit event without credentials or request payloads', () => {
    const event = createAuditEvent({
      requestId: 'request-1',
      toolName: 'list_projects',
      projectId: 4,
      resourceId: null,
      resultStatus: 'success',
      durationMs: 12,
      recordCount: 1,
      errorCode: null,
    });

    expect(event).toEqual({
      actor: 'bob-agent',
      requestId: 'request-1',
      toolName: 'list_projects',
      projectId: 4,
      resourceId: null,
      resultStatus: 'success',
      durationMs: 12,
      recordCount: 1,
      errorCode: null,
    });
    expect(JSON.stringify(event)).not.toContain('safe-test-token');
    expect(JSON.stringify(event)).not.toContain('authorization');
  });

  it('maps failures to fixed safe error codes', () => {
    expect(sanitizeErrorCode(new Error('postgres://secret@localhost failed'))).toBe(
      'internal_error',
    );
    expect(sanitizeErrorCode({ code: 'not_found' })).toBe('not_found');
  });

  it('enforces a request timeout', async () => {
    await expect(withTimeout(new Promise(() => {}), 5)).rejects.toMatchObject({
      code: 'timeout',
    });
  });
});
