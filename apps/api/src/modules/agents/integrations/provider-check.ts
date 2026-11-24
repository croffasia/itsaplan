import { getProviderConfig } from '@mastra/core/llm';
import type { CredentialCheck, ToolConfig } from '@repo/agent-tools';

// How to ask an AI provider whether it accepts a key, with a request that spends
// nothing. `auth` builds the headers that carry the key (a bearer token when left out);
// `rejected` lists the statuses that mean a refusal (401 and 403 when left out).
export interface ProviderCheck {
  url: string;
  auth?: (key: string) => Record<string, string>;
  rejected?: number[];
}

// Providers whose address Mastra's registry leaves to their own SDK, and OpenRouter,
// whose /models answers any key. Every other provider is asked for /models at the
// registry's address. Kept by hand: a stale entry only leaves a key unchecked.
const PROVIDER_CHECKS: Record<string, ProviderCheck> = {
  openai: { url: 'https://api.openai.com/v1/models' },
  anthropic: {
    url: 'https://api.anthropic.com/v1/models',
    auth: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
  },
  // Google and xAI refuse a key with 400.
  google: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models',
    auth: (key) => ({ 'x-goog-api-key': key }),
    rejected: [400, 401, 403],
  },
  xai: { url: 'https://api.x.ai/v1/api-key', rejected: [400, 401, 403] },
  cerebras: { url: 'https://api.cerebras.ai/v1/models' },
  perplexity: { url: 'https://api.perplexity.ai/v1/models' },
  togetherai: { url: 'https://api.together.xyz/v1/models' },
  deepinfra: { url: 'https://api.deepinfra.com/v1/openai/models' },
  vercel: { url: 'https://ai-gateway.vercel.sh/v1/credits' },
  openrouter: { url: 'https://openrouter.ai/api/v1/key' },
};

// The check for a provider key, or null when there is no address to ask. A base URL
// on the credential (the OpenAI-compatible catch-all) is where the key is used, so it
// is asked there. A registry address with a ${...} placeholder (an account id, a host)
// is not a real address: asking it could read a valid key as refused.
export function providerCheck(provider: string, config: ToolConfig): ProviderCheck | null {
  const known = PROVIDER_CHECKS[provider];
  if (known) return known;
  const base = config.baseUrl ? String(config.baseUrl) : getProviderConfig(provider)?.url;
  if (!base || base.includes('${')) return null;
  return { url: `${base.replace(/\/+$/, '')}/models` };
}

// What a provider's answer to the check says. A 404 or 405 means it has no such request,
// so the key cannot be checked. A refusal counts only when the API itself sends it: a bot
// wall or a proxy answers 403 too, with a page rather than JSON.
export function readAnswer(res: Response, rejected: number[]): CredentialCheck {
  if (res.ok) return 'valid';
  if (res.status === 404 || res.status === 405) return 'unknown';
  const fromApi = res.headers.get('content-type')?.includes('json');
  return fromApi && rejected.includes(res.status) ? 'rejected' : 'unavailable';
}
