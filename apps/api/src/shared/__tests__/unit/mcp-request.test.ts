import { describe, expect, it } from 'bun:test';
import {
  getMcpOAuthToken,
  isMcpRequest,
  MCP_LOOPBACK_HEADER,
  setMcpOAuthToken,
} from '../../mcp-request';

describe('MCP request context', () => {
  it('does not resolve a token supplied through request headers', () => {
    const request = new Request('http://localhost/projects', {
      headers: {
        [MCP_LOOPBACK_HEADER]: '1',
        'x-mcp-oauth-token': 'forged',
      },
    });

    expect(isMcpRequest(request.headers)).toBe(true);
    expect(getMcpOAuthToken(request)).toBeUndefined();
  });

  it('carries an OAuth token only on the in-process request object', () => {
    const request = new Request('http://localhost/projects');
    setMcpOAuthToken(request, 'access-token');

    expect(getMcpOAuthToken(request)).toBe('access-token');
  });
});
