import { getIntegration, type CredentialCheck, type ToolConfig } from '@repo/agent-tools';
import { pinnedFetch, UrlNotAllowedError } from '@repo/net';
import { integrationKind } from './catalog';
import { providerCheck, readAnswer } from './provider-check';

type CredentialChecker = (integrationKey: string, config: ToolConfig) => Promise<CredentialCheck>;

// The person saving the credential waits for the answer.
const CHECK_TIMEOUT_MS = 10_000;

// Asks the service a credential is for whether it accepts it: an AI provider through
// providerCheck, a tool integration through its own verify.
async function askService(integrationKey: string, config: ToolConfig): Promise<CredentialCheck> {
  const signal = AbortSignal.timeout(CHECK_TIMEOUT_MS);
  try {
    if (integrationKind(integrationKey) === 'tool') {
      const verify = getIntegration(integrationKey)?.verify;
      return verify ? await verify(config, signal) : 'unknown';
    }
    const check = providerCheck(integrationKey, config);
    if (!check) return 'unknown';
    const key = String(config.apiKey ?? '');
    const res = await pinnedFetch(check.url, {
      headers: check.auth ? check.auth(key) : { Authorization: `Bearer ${key}` },
      signal,
    });
    return readAnswer(res, check.rejected ?? [401, 403]);
  } catch (err) {
    // An address the SSRF guard keeps the api from (a local LM Studio, a Gitea on a private
    // network) cannot be checked from here. Any other failure is a check with no answer.
    return err instanceof UrlNotAllowedError ? 'unknown' : 'unavailable';
  }
}

let checker: CredentialChecker = askService;

// Replaces how every credential is checked. The api test preload answers "unknown": the
// tests' secrets are made up, and the suite does not reach services on the internet.
export function setCredentialChecker(next: CredentialChecker): void {
  checker = next;
}

export function checkCredential(
  integrationKey: string,
  config: ToolConfig,
): Promise<CredentialCheck> {
  return checker(integrationKey, config);
}
