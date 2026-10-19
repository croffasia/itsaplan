import { createHash, randomBytes } from 'node:crypto';
import { db, integrationCredential, team } from '@repo/db';
import { eq } from 'drizzle-orm';
import {
  listMcpTools,
  McpAuthRequiredError,
  MCP_INTEGRATION_KEY,
  type McpTool,
  type ToolConfig,
} from '@repo/agent-tools';
import { decryptSecret, encryptSecret } from '@repo/crypto';
import { HttpError } from '#shared/lib';
import { pinnedFetch } from '#shared/net';
import { teamRef } from '#modules/teams/ref';
import { errorMessage } from '../core/helpers/errors';
import { credentialSchemaFor } from './catalog';
import { getCredentialSecret, redactCredential } from './service';

// OAuth for an MCP server per the MCP authorization spec. The tokens are kept in the
// credential's encrypted config under `oauth`. The server's metadata names the hosts
// called here, so every request goes through the SSRF guard.

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 1_000_000;
const STATE_TTL_MS = 10 * 60_000;
const EXPIRY_MARGIN_MS = 60_000;

const apiUrl = () => (process.env.API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const appUrl = () =>
  (process.env.APP_URL?.split(',')[0]?.trim() || 'http://localhost:3001').replace(/\/+$/, '');
const redirectUri = () => `${apiUrl()}/integrations/mcp/callback`;

interface OAuthClient {
  tokenEndpoint: string;
  clientId: string;
  clientSecret?: string;
  resource: string;
}

interface StoredOAuth extends OAuthClient {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

// Travels in `state`, encrypted and authenticated, so it cannot be read or forged.
interface PendingSignIn extends OAuthClient {
  credentialId: number;
  teamId: number;
  userId: string;
  verifier: string;
  expiresAt: number;
}

const base64url = (buf: Buffer) => buf.toString('base64url');

function sealState(pending: PendingSignIn): string {
  const enc = encryptSecret(JSON.stringify(pending));
  return [enc.iv, enc.authTag, enc.ciphertext]
    .map((part) => base64url(Buffer.from(part, 'base64')))
    .join('.');
}

function openState(state: string): PendingSignIn {
  const [iv, authTag, ciphertext] = state
    .split('.')
    .map((part) => Buffer.from(part, 'base64url').toString('base64'));
  let pending: PendingSignIn;
  try {
    pending = JSON.parse(decryptSecret({ iv: iv!, authTag: authTag!, ciphertext: ciphertext! }));
  } catch {
    throw new HttpError(400, 'Invalid sign-in state');
  }
  if (Date.now() > pending.expiresAt) throw new HttpError(400, 'The sign-in has expired');
  return pending;
}

async function fetchJson(url: string, init?: Parameters<typeof pinnedFetch>[1]) {
  const res = await pinnedFetch(url, {
    timeoutMs: TIMEOUT_MS,
    maxBytes: MAX_BYTES,
    ...init,
    headers: { accept: 'application/json', ...(init?.headers as Record<string, string>) },
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: res.ok, status: res.status, body };
}

async function firstMetadata(urls: string[]): Promise<Record<string, unknown> | null> {
  for (const url of urls) {
    const res = await fetchJson(url).catch(() => null);
    if (res?.ok && res.body) return res.body;
  }
  return null;
}

// RFC 8414 and OpenID Connect discovery put the well-known segment before the path.
function wellKnown(issuer: string, name: string): string {
  const u = new URL(issuer);
  const path = u.pathname.replace(/\/+$/, '');
  return `${u.origin}/.well-known/${name}${path}`;
}

async function discover(serverUrl: string) {
  const resourceMeta = await firstMetadata([
    wellKnown(serverUrl, 'oauth-protected-resource'),
    `${new URL(serverUrl).origin}/.well-known/oauth-protected-resource`,
  ]);
  const servers = resourceMeta?.authorization_servers;
  const issuer =
    Array.isArray(servers) && typeof servers[0] === 'string'
      ? servers[0]
      : new URL(serverUrl).origin;
  const meta = await firstMetadata([
    wellKnown(issuer, 'oauth-authorization-server'),
    wellKnown(issuer, 'openid-configuration'),
  ]);
  const authorizationEndpoint = meta?.authorization_endpoint;
  const tokenEndpoint = meta?.token_endpoint;
  const registrationEndpoint = meta?.registration_endpoint;
  if (typeof authorizationEndpoint !== 'string' || typeof tokenEndpoint !== 'string') {
    throw new HttpError(400, 'The MCP server publishes no OAuth authorization server');
  }
  if (typeof registrationEndpoint !== 'string') {
    throw new HttpError(400, "The MCP server's authorization server does not register clients");
  }
  const scopes = resourceMeta?.scopes_supported;
  return {
    resource: typeof resourceMeta?.resource === 'string' ? resourceMeta.resource : serverUrl,
    authorizationEndpoint,
    tokenEndpoint,
    registrationEndpoint,
    scope: Array.isArray(scopes) ? scopes.join(' ') : undefined,
  };
}

async function tokenRequest(client: OAuthClient, params: Record<string, string>) {
  const res = await fetchJson(client.tokenEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...params,
      client_id: client.clientId,
      ...(client.clientSecret ? { client_secret: client.clientSecret } : {}),
      resource: client.resource,
    }).toString(),
  });
  const body = res.body ?? {};
  if (!res.ok || typeof body.access_token !== 'string') {
    const reason = body.error_description ?? body.error ?? `status ${res.status}`;
    throw new HttpError(400, `The token request failed: ${String(reason)}`);
  }
  return {
    accessToken: body.access_token,
    refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : undefined,
    expiresAt:
      typeof body.expires_in === 'number' ? Date.now() + body.expires_in * 1000 : undefined,
  };
}

async function storeOAuth(
  exec: Pick<typeof db, 'update'>,
  credentialId: number,
  config: ToolConfig,
  oauth: StoredOAuth,
): Promise<ToolConfig> {
  const next = { ...config, oauth: JSON.stringify(oauth) };
  const enc = encryptSecret(JSON.stringify(next));
  await exec
    .update(integrationCredential)
    .set({
      ciphertext: enc.ciphertext,
      iv: enc.iv,
      authTag: enc.authTag,
      redacted: redactCredential(credentialSchemaFor(MCP_INTEGRATION_KEY)!, next),
    })
    .where(eq(integrationCredential.id, credentialId));
  return next;
}

export async function startMcpSignIn(
  credentialId: number,
  teamId: number,
  userId: string,
): Promise<string | null> {
  const secret = await getCredentialSecret(credentialId, teamId);
  if (secret?.integrationKey !== MCP_INTEGRATION_KEY) return null;
  const found = await discover(String(secret.config.url));
  const registered = await fetchJson(found.registrationEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: 'itsaplan',
      redirect_uris: [redirectUri()],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  });
  const clientId = registered.body?.client_id;
  if (!registered.ok || typeof clientId !== 'string') {
    throw new HttpError(400, `Client registration failed (status ${registered.status})`);
  }
  const clientSecret = registered.body?.client_secret;
  const verifier = base64url(randomBytes(32));
  const state = sealState({
    credentialId,
    teamId,
    userId,
    verifier,
    expiresAt: Date.now() + STATE_TTL_MS,
    tokenEndpoint: found.tokenEndpoint,
    clientId,
    clientSecret: typeof clientSecret === 'string' ? clientSecret : undefined,
    resource: found.resource,
  });
  const url = new URL(found.authorizationEndpoint);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri(),
    code_challenge: base64url(createHash('sha256').update(verifier).digest()),
    code_challenge_method: 'S256',
    state,
    resource: found.resource,
    ...(found.scope ? { scope: found.scope } : {}),
  }).toString();
  return url.toString();
}

async function integrationsPage(teamId: number): Promise<string> {
  const [row] = await db
    .select({ id: team.id, slug: team.slug })
    .from(team)
    .where(eq(team.id, teamId));
  return `${appUrl()}/${row ? teamRef(row) : teamId}/settings/integrations`;
}

// Bound to the account that started it, so a sign-in URL handed to someone else cannot
// store their tokens in this credential.
export async function finishMcpSignIn(
  query: { state?: string; code?: string; error?: string; error_description?: string },
  userId: string | undefined,
): Promise<string> {
  if (!query.state) throw new HttpError(400, 'Missing sign-in state');
  const pending = openState(query.state);
  if (pending.userId !== userId) {
    throw new HttpError(403, 'This sign-in was started by another account');
  }
  const page = new URL(await integrationsPage(pending.teamId));
  try {
    if (!query.code) throw new Error(query.error_description ?? query.error ?? 'No code');
    const secret = await getCredentialSecret(pending.credentialId, pending.teamId);
    if (secret?.integrationKey !== MCP_INTEGRATION_KEY) throw new Error('Credential not found');
    const tokens = await tokenRequest(pending, {
      grant_type: 'authorization_code',
      code: query.code,
      redirect_uri: redirectUri(),
      code_verifier: pending.verifier,
    });
    const { tokenEndpoint, clientId, clientSecret, resource } = pending;
    await storeOAuth(db, pending.credentialId, secret.config, {
      tokenEndpoint,
      clientId,
      clientSecret,
      resource,
      ...tokens,
    });
  } catch (err) {
    page.searchParams.set('mcp_error', errorMessage(err, 'The sign-in failed'));
  }
  return page.toString();
}

const expired = (oauth: StoredOAuth) =>
  oauth.expiresAt !== undefined && Date.now() > oauth.expiresAt - EXPIRY_MARGIN_MS;

const withBearer = (config: ToolConfig, oauth: StoredOAuth): ToolConfig => ({
  ...config,
  headerName: 'Authorization',
  headerValue: `Bearer ${oauth.accessToken}`,
});

// The renewal reads the row again under its lock, so concurrent runs renew once and a
// rotated refresh token is never spent twice.
export async function freshMcpCredential(
  credentialId: number,
  config: ToolConfig,
): Promise<ToolConfig> {
  if (typeof config.oauth !== 'string') return config;
  const oauth = JSON.parse(config.oauth) as StoredOAuth;
  if (!expired(oauth)) return withBearer(config, oauth);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        ciphertext: integrationCredential.ciphertext,
        iv: integrationCredential.iv,
        authTag: integrationCredential.authTag,
      })
      .from(integrationCredential)
      .where(eq(integrationCredential.id, credentialId))
      .for('update');
    if (!row) return config;
    const current = JSON.parse(decryptSecret(row)) as ToolConfig;
    if (typeof current.oauth !== 'string') return current;
    const stored = JSON.parse(current.oauth) as StoredOAuth;
    if (!expired(stored)) return withBearer(current, stored);
    if (!stored.refreshToken) {
      throw new McpAuthRequiredError('The MCP sign-in has expired: connect the server again');
    }
    const tokens = await tokenRequest(stored, {
      grant_type: 'refresh_token',
      refresh_token: stored.refreshToken,
    });
    const renewed = {
      ...stored,
      ...tokens,
      refreshToken: tokens.refreshToken ?? stored.refreshToken,
    };
    return withBearer(await storeOAuth(tx, credentialId, current, renewed), renewed);
  });
}

export async function listCredentialMcpTools(
  id: number,
  teamId: number,
): Promise<McpTool[] | null> {
  const secret = await getCredentialSecret(id, teamId);
  if (secret?.integrationKey !== MCP_INTEGRATION_KEY) return null;
  try {
    return await listMcpTools(await freshMcpCredential(id, secret.config));
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof McpAuthRequiredError) {
      throw new HttpError(400, 'The MCP server asks for authorization: connect it first');
    }
    throw new HttpError(400, `MCP server: ${errorMessage(err, 'unreachable')}`);
  }
}
