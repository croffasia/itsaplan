import type { ToolConfig } from '../../types';

// Authorization header for a Jina API call from the integration credential.
export function jinaAuth(credential: ToolConfig): Record<string, string> {
  const apiKey = credential.apiKey ? String(credential.apiKey) : '';
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}
