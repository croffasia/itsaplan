import { randomInt } from 'node:crypto';
import { createWorkspace, db } from '@repo/db';
import { and, eq, gt, isNull, sql, type SQL } from 'drizzle-orm';
import { betterAuth, type BetterAuthPlugin } from 'better-auth';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { passkey } from '@better-auth/passkey';
import { apiKey } from '@better-auth/api-key';
import { mcp } from '@better-auth/mcp';
import { sso } from '@better-auth/sso';
import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from '@better-auth/oauth-provider';
import { jwt, openAPI, magicLink, username, genericOAuth } from 'better-auth/plugins';
import { createLocalJWKSet, jwtVerify } from 'jose';
import * as schema from '@repo/db/schema';
import {
  getAuthSettings,
  admittedPastGate,
  registrationEmailAllowed,
  hasPendingInvite,
  hasExpiredInvite,
  getGoogleConfig,
  isGoogleUsable,
  getOidcConfig,
  isOidcUsable,
  getSamlConfig,
  isSamlUsable,
  isAccountDeactivated,
} from './instance';
import { buildSpMetadata } from './saml';
import { sendAuthEmail } from './mail';
import { readAuthExtensions } from './extensions';

// Frontend origins allowed to call the auth handler. Mandatory config: cookies, the
// WebAuthn relying party and the cookie domain are all derived from it, so a deploy
// that misses it has to fail at startup instead of running on a localhost default.
export const trustedOrigins = (process.env.APP_URL ?? '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);
if (trustedOrigins.length === 0) {
  throw new Error('APP_URL is not set: public origin(s) of the web app.');
}

// Parent domain for a cross-subdomain session cookie (".example.com" from
// "app.example.com"). Returns undefined for localhost, IPs, or apex domains, where
// no cross-subdomain sharing is needed. Used so the SSR web app on one subdomain can
// read the session cookie set by the api on a sibling subdomain.
function parentDomain(origin: string | undefined): string | undefined {
  if (!origin) return undefined;
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return undefined;
  }
  if (host === 'localhost' || /^[\d.]+$/.test(host)) return undefined;
  const labels = host.split('.');
  if (labels.length < 3) return undefined;
  return '.' + labels.slice(1).join('.');
}

function safeUrl(value: string | undefined): URL | undefined {
  if (!value) return undefined;
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

// parentDomain() would widen the cookie to sibling subdomains even when web and api
// share a host, where a host-only cookie is enough.
const sameHost = safeUrl(trustedOrigins[0])?.hostname === safeUrl(process.env.API_URL)?.hostname;

// COOKIE_DOMAIN wins (multi-label TLDs, deep subdomains); otherwise host-only when web
// and api share a host, else the parent domain of the frontend.
const cookieDomain =
  process.env.COOKIE_DOMAIN || (sameHost ? undefined : parentDomain(trustedOrigins[0]));

// WebAuthn relying-party id: the frontend domain the passkey is bound to (no port,
// no scheme). The WebAuthn ceremony runs in the frontend JS, so the expected origin
// is the frontend origin(s) — the same trustedOrigins list. On localhost this all
// works over http (localhost is a secure context). In prod set PASSKEY_RP_ID to the
// public frontend hostname.
const passkeyRpID = process.env.PASSKEY_RP_ID ?? new URL(trustedOrigins[0]).hostname;

// Public URL of the backend, with the path a subpath proxy adds; the links in auth
// emails and the OAuth redirect URIs are built from it.
const apiPublicUrl = (process.env.API_URL ?? '').replace(/\/+$/, '');
if (!apiPublicUrl) {
  throw new Error('API_URL is not set: public URL of the backend.');
}
const apiUrl = safeUrl(apiPublicUrl);
if (!apiUrl) {
  throw new Error(`API_URL is not a valid URL: ${apiPublicUrl}`);
}

// A baseURL with a path replaces better-auth's /api/auth basePath and the api's fixed
// mount stops matching, so it only gets the origin.
const baseURL = apiUrl.origin;
const apiHasPath = apiUrl.pathname !== '/';

// Over HTTPS with a host-only cookie the session cookies carry the __Host- prefix:
// the browser then refuses a cookie of that name planted by a sibling subdomain (with
// a Domain, or a narrower Path), which __Secure- does not prevent. better-auth only
// writes __Secure-, so its automatic prefix is turned off and both prefixes are written
// into the names here.
const hostPrefixedCookies = baseURL.startsWith('https://') && !cookieDomain;
const SESSION_COOKIES = ['session_token', 'session_data', 'account_data', 'dont_remember'];

// better-auth builds the links it hands to the mailers from the origin-only baseURL;
// this puts the path back.
function withPublicOrigin(url: string): string {
  return url.startsWith(baseURL) ? apiPublicUrl + url.slice(baseURL.length) : url;
}

// The MCP authorization server. Its issuer is the public URL of the api, so the access
// tokens, the authorization responses and the discovery documents name the URL a
// client reaches, behind a path prefix too.
const MCP_ISSUER = apiPublicUrl;
const MCP_RESOURCE = `${apiPublicUrl}/mcp`;

// better-auth accepts a plain-HTTP MCP resource only on a loopback host. Any other
// instance without HTTPS serves MCP to personal API keys only.
const mcpOAuth =
  apiUrl.protocol === 'https:' ||
  apiUrl.hostname === 'localhost' ||
  apiUrl.hostname === '[::1]' ||
  apiUrl.hostname.startsWith('127.');

// The discovery documents list endpoints built from the origin-only baseURL; behind a
// path prefix they would land on whatever serves the root of the host.
async function withPublicDiscoveryUrls(response: Response): Promise<Response> {
  if (!apiHasPath || !response.ok) return response;
  const authBase = `${baseURL}/api/auth`;
  const toPublic = (value: unknown) =>
    typeof value === 'string' && value.startsWith(authBase) ? withPublicOrigin(value) : value;
  const metadata = (await response.json()) as Record<string, unknown>;
  for (const [key, value] of Object.entries(metadata)) {
    metadata[key] = Array.isArray(value) ? value.map(toPublic) : toPublic(value);
  }
  return Response.json(metadata, { status: response.status, headers: response.headers });
}

const notFound = () => new Response(null, { status: 404 });

export async function oauthAuthorizationServerMetadata(request: Request): Promise<Response> {
  if (!mcpOAuth) return notFound();
  return withPublicDiscoveryUrls(await oauthProviderAuthServerMetadata(auth)(request));
}

export async function openIdConfiguration(request: Request): Promise<Response> {
  if (!mcpOAuth) return notFound();
  return withPublicDiscoveryUrls(await oauthProviderOpenIdConfigMetadata(auth)(request));
}

// The mcp plugin serves this document itself, for a request under its own path.
export async function oauthProtectedResourceMetadata(): Promise<Response> {
  if (!mcpOAuth) return notFound();
  return auth.handler(new Request(`${baseURL}/.well-known/oauth-protected-resource`));
}

// The answer to an MCP request without a usable credential. The challenge names the
// resource metadata, which is where an MCP client starts the OAuth flow.
export function mcpUnauthorized(): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (mcpOAuth) {
    headers.set(
      'WWW-Authenticate',
      `Bearer resource_metadata="${apiPublicUrl}/.well-known/oauth-protected-resource/mcp"`,
    );
  }
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Unauthorized' }, id: null }),
    { status: 401, headers },
  );
}

// The account an MCP access token was issued to, or null when the token is not valid
// or the account is deactivated. The tokens are JWTs signed with this instance's keys
// and are checked against them in-process: requireMcpAuth fetches the key set over
// HTTP from the public URL, which a container cannot always reach. A JWT stays valid
// until it expires, so the rest is read on every request, as better-auth's own
// introspection does: a token issued in a session ends with it, and so does every
// token of a deactivated account. A DPoP-bound token is valid only with its proof,
// which this check does not take.
export async function verifyMcpAccessToken(token: string): Promise<string | null> {
  if (!mcpOAuth) return null;
  let claims: { sub?: string; sid?: unknown; cnf?: unknown; client_id?: unknown };
  try {
    ({ payload: claims } = await jwtVerify(token, createLocalJWKSet(await auth.api.getJwks()), {
      issuer: MCP_ISSUER,
      audience: MCP_RESOURCE,
    }));
  } catch {
    return null;
  }
  if (claims.cnf || !claims.sub) return null;
  const [account] = await db
    .select({ active: schema.user.active })
    .from(schema.user)
    .where(eq(schema.user.id, claims.sub));
  if (!account || isAccountDeactivated(account)) return null;
  // Disconnecting the application on the account's Security page ends its tokens at once.
  if (typeof claims.client_id !== 'string') return null;
  if (!(await isClientConnected(claims.sub, claims.client_id))) return null;
  if (typeof claims.sid === 'string') {
    const [open] = await db
      .select({ n: sql`1` })
      .from(schema.session)
      .where(and(eq(schema.session.id, claims.sid), gt(schema.session.expiresAt, new Date())));
    if (!open) return null;
  }
  return claims.sub;
}

// Connected while the person's consent stands or a refresh token can still mint tokens,
// the same rule the Security page lists applications by.
async function isClientConnected(userId: string, clientId: string): Promise<boolean> {
  const [consent] = await db
    .select({ n: sql`1` })
    .from(schema.oauthConsent)
    .where(and(eq(schema.oauthConsent.userId, userId), eq(schema.oauthConsent.clientId, clientId)))
    .limit(1);
  if (consent) return true;
  const [refresh] = await db
    .select({ n: sql`1` })
    .from(schema.oauthRefreshToken)
    .where(
      and(
        eq(schema.oauthRefreshToken.userId, userId),
        eq(schema.oauthRefreshToken.clientId, clientId),
        isNull(schema.oauthRefreshToken.revoked),
        gt(schema.oauthRefreshToken.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return Boolean(refresh);
}

// An error better-auth cannot hand back to the page that started the flow lands here.
// Its own /api/auth/error is outside a path prefix and, on the api's own host, sends a
// production browser to the api's root; /login turns ?error= into a message.
const oauthErrorURL = `${trustedOrigins[0]}/login`;

// User roles. "god" is the owner of the instance: the very first registered user
// gets it automatically; everyone after is a plain "user". The role is assigned
// server-side (input: false) so a client cannot request it at sign-up.
export const USER_ROLES = ['god', 'user'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// The exact authorized redirect URI to register in the Google Cloud console;
// god mode shows it for copying.
export const GOOGLE_REDIRECT_URI = `${apiPublicUrl}/api/auth/callback/google`;

// Google OAuth credentials live in the database (god mode), not in env. The provider
// is built once at startup, but it keeps this options object by reference and reads
// clientId / clientSecret off it on every call, so refreshing the object per request
// is what lets the owner change or revoke the credentials without a restart.
// redirectURI is explicit: the one inferred from the origin-only baseURL lacks the path.
const googleOptions = { clientId: '', clientSecret: '', redirectURI: GOOGLE_REDIRECT_URI };

// Loads the stored credentials into that object and reports whether Google sign-in
// can run. A read failure disables the provider rather than failing the request with
// a stale secret.
async function refreshGoogleOptions(): Promise<boolean> {
  try {
    const config = await getGoogleConfig();
    googleOptions.clientId = config.clientId;
    googleOptions.clientSecret = config.clientSecret;
    return isGoogleUsable(config);
  } catch (error) {
    console.error('[auth] could not read the Google credentials:', error);
    return false;
  }
}

// The generic OIDC provider. One per instance, so its id is a constant: it is what
// the `account` rows store.
export const OIDC_PROVIDER_ID = 'oidc';

// The redirect URI to register with the identity provider; god mode shows it for
// copying. better-auth serves the callback at /callback/oidc and the api passes this
// path on to it, so a provider registered with it keeps working.
export const OIDC_REDIRECT_URI = `${apiPublicUrl}/api/auth/oauth2/callback/${OIDC_PROVIDER_ID}`;

type PluginContext = Parameters<NonNullable<BetterAuthPlugin['init']>>[0];
type SocialProvider = PluginContext['socialProviders'][number];

// genericOAuth reads the discovery document once, when the plugin starts, and keeps
// the endpoints it found, while this provider is configured in god mode and changes
// without a restart. So better-auth holds this proxy, and every read on it goes to a
// provider genericOAuth built from the stored settings.
let oidc: { settings: string; provider: SocialProvider } | undefined;
const oidcProvider = new Proxy({ id: OIDC_PROVIDER_ID } as SocialProvider, {
  get: (fallback, key) => Reflect.get(oidc?.provider ?? fallback, key),
});

// Rebuilds the provider when the stored settings changed and reports whether OIDC
// sign-in can run. A failed read or discovery disables the provider rather than
// running the request on stale settings.
async function refreshOidcProvider(): Promise<boolean> {
  try {
    const config = await getOidcConfig();
    if (!isOidcUsable(config)) return false;
    const settings = JSON.stringify(config);
    if (oidc?.settings === settings) return true;
    const plugin = genericOAuth({
      config: [
        {
          providerId: OIDC_PROVIDER_ID,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          discoveryUrl: config.discoveryUrl,
          scopes: config.scopes,
          pkce: config.pkce,
          // redirectURI is explicit for the same reason as in googleOptions.
          redirectURI: OIDC_REDIRECT_URI,
          // The `account` rows hold the OIDC subject. genericOAuth reads `id` instead
          // when the discovery document lists no id_token signing algorithms.
          accountSubject: ({ profile }) => String(profile.sub ?? ''),
          // Signing out of the app leaves the session at the identity provider alone.
          disableProviderLogout: true,
        },
      ],
    });
    const built = await plugin.init({ ...pluginContext!, socialProviders: [] });
    // genericOAuth skips a provider whose discovery failed, and logs why.
    const provider = built?.context?.socialProviders?.[0];
    if (!provider) return false;
    oidc = { settings, provider };
    return true;
  } catch (error) {
    console.error('[auth] could not load the OIDC provider:', error);
    return false;
  }
}

// The context genericOAuth builds a provider in; kept from startup, when better-auth
// hands it to the plugin below.
let pluginContext: PluginContext | undefined;

const instanceOidc = (): BetterAuthPlugin => ({
  id: 'instance-oidc',
  init: (context) => {
    pluginContext = context;
    return { context: { socialProviders: [oidcProvider, ...context.socialProviders] } };
  },
});

// The instance's SAML identity provider. One per instance, so its id is a constant: it
// is what the `account` rows store, next to the NameID.
export const SAML_PROVIDER_ID = 'saml';

// What the IdP is told about this instance; god mode shows them for copying. The ACS URL
// is where the IdP posts its response, and the metadata URL serves both in one document.
export const SAML_ACS_URL = `${apiPublicUrl}/api/auth/sso/saml2/sp/acs/${SAML_PROVIDER_ID}`;
export const SAML_SP_METADATA_URL = `${apiPublicUrl}/api/auth/sso/saml2/sp/metadata?providerId=${SAML_PROVIDER_ID}`;
// The entity id when god mode leaves it empty: the metadata URL, as most IdPs expect.
export const SAML_SP_ENTITY_ID = SAML_SP_METADATA_URL;

type DefaultSso = NonNullable<NonNullable<Parameters<typeof sso>[0]>['defaultSSO']>;

// The SSO plugin reads `defaultSSO` off its options on every request, so it holds this
// array, and refreshSamlProvider() refills it from the stored settings. Its own
// `sso_provider` table stays empty: providers there are registered by signed-in users,
// and those endpoints are in disabledPaths. refreshSamlProvider() must clear and refill
// it with no `await` in between, or a concurrent request reads it half-filled.
const samlProviders: DefaultSso = [];

// Loads the stored provider into that array and reports whether a SAML sign-in may run.
// The provider is loaded while it only has metadata, so the SP metadata URL answers
// before the switch is turned on; a sign-in also needs the switch.
async function refreshSamlProvider(): Promise<boolean> {
  try {
    const config = await getSamlConfig();
    samlProviders.length = 0;
    if (!config.idpMetadataXml) return false;
    const entityId = config.entityId || SAML_SP_ENTITY_ID;
    samlProviders.push({
      providerId: SAML_PROVIDER_ID,
      // Matched only when a sign-in names no provider; the screen always names it.
      domain: apiUrl!.hostname,
      samlConfig: {
        issuer: entityId,
        // Read from the metadata instead.
        entryPoint: '',
        callbackUrl: `${trustedOrigins[0]}/`,
        idpMetadata: { metadata: config.idpMetadataXml },
        spMetadata: { metadata: buildSpMetadata({ entityId, acsUrl: SAML_ACS_URL }) },
        wantAssertionsSigned: true,
        mapping: {
          email: config.emailAttribute || undefined,
          name: config.nameAttribute || undefined,
        },
      },
    });
    return isSamlUsable(config);
  } catch (error) {
    console.error('[auth] could not load the SAML provider:', error);
    samlProviders.length = 0;
    return false;
  }
}

// The two conditions better-auth checks before linking an address to an account that
// already has it are read from different places: `trustedProviders` per request,
// through the resolver below, and `requireLocalEmailVerified` off the options object
// at the moment of the decision. The resolver runs first, in the same request, and
// leaves the setting here for the getter to read.
let trustProviderEmails = false;

// The trusted providers for one request. The settings are read where a provider's
// sign-in comes back — an OAuth callback, or a SAML response posted to `/acs/` — only:
// the resolver runs on every request to the auth API, and a session check has no linking
// decision to make.
const PROVIDER_RETURN = /\/(callback|acs)\//;

async function resolveTrustedProviders(request?: Request): Promise<string[]> {
  if (!request || !PROVIDER_RETURN.test(new URL(request.url).pathname)) return [];
  trustProviderEmails = (await getAuthSettings()).trustProviderEmails;
  return trustProviderEmails ? ['google', OIDC_PROVIDER_ID, SAML_PROVIDER_ID] : [];
}

// Whether a new account has to confirm its address before it gets a session. An
// instance setting, read in `hooks.before` on every password endpoint and served to
// better-auth through the getter on `emailAndPassword` below: sign-up reads the
// option off the options object at the moment it decides whether to open a session,
// so a getter is what lets the stored setting reach a config that is built once.
let verificationRequired = false;

// The endpoints of the email/password form, including the two the magic link uses.
// Turning password authentication off refuses all of them, so a link issued before
// the switch was flipped cannot still be redeemed. Passkey sign-in is not here: a
// passkey is only ever added to an account that already exists, so it cannot be used
// to get around single sign-on.
const PASSWORD_PATHS = new Set([
  '/sign-up/email',
  '/sign-in/email',
  '/sign-in/username',
  '/request-password-reset',
  '/reset-password',
  '/sign-in/magic-link',
  '/magic-link/verify',
]);

const REGISTRATION_REFUSALS = {
  REGISTRATION_CLOSED: 'Registration is closed on this instance',
  INVITE_ONLY: 'This instance is invite-only. Ask a project owner to invite this address.',
  INVITE_EXPIRED: 'The invite for this address has expired. Ask for a new one.',
  EMAIL_DOMAIN_NOT_ALLOWED: 'This instance does not admit addresses at this domain',
} as const;

function refuseRegistration(code: keyof typeof REGISTRATION_REFUSALS): never {
  throw new APIError('FORBIDDEN', { code, message: REGISTRATION_REFUSALS[code] });
}

// The registration gate: who may create an account. Both sign-up paths run it — the
// email form checks it up front (below), and the user create hook catches every other
// path, which is what stops a Google, OIDC or magic-link sign-up on a closed or
// invite-only instance. Telling an expired invite apart reveals that the address was
// invited, so it is said only once the address is proven (a provider or a magic link):
// the email form, open to anyone, gets the plain invite-only refusal. Each refusal
// carries a `code`, which is what the provider callback and the magic link turn into the
// ?error= they redirect with; without one the callback would fail the request instead.
async function assertRegistrationAllowed(
  email: string,
  { addressProven }: { addressProven: boolean },
): Promise<void> {
  const settings = await getAuthSettings();
  if (settings.registration === 'closed') refuseRegistration('REGISTRATION_CLOSED');
  if (!(await registrationEmailAllowed(email))) refuseRegistration('EMAIL_DOMAIN_NOT_ALLOWED');
  if (settings.registration === 'invite' && !(await hasPendingInvite(email))) {
    const expired = addressProven && (await hasExpiredInvite(email));
    refuseRegistration(expired ? 'INVITE_EXPIRED' : 'INVITE_ONLY');
  }
}

// True when an account matching the sign-in identifier exists and has not confirmed
// its address. Used to hold back sign-in while the instance requires verification. An
// unknown identifier is not "unverified" — it falls through to better-auth's own
// invalid-credentials answer, so this never reveals whether an account exists.
async function isUnverified(where: SQL): Promise<boolean> {
  const rows = await db
    .select({ emailVerified: schema.user.emailVerified })
    .from(schema.user)
    .where(where);
  return rows[0] ? !rows[0].emailVerified : false;
}

// Username rules. The bounds are the plugin's own defaults, repeated here because the
// generator below has to stay inside them.
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 30;
const SUFFIX_LENGTH = 3;

// Three digits appended to a name that is taken, or too short to stand on its own.
// Drawn from the crypto source: the digits are not a secret, but this function sits
// in the sign-up path, where a predictable generator is worth nobody's argument.
function randomSuffix(): string {
  return String(100 + randomInt(900));
}

// Accounts that need no personal workspace made: they own a workspace, or are an agent's
// bot user. Kept per process, so once an account is known a request costs a lookup here
// and nothing in the database.
const settled = new Set<string>();

// The personal workspace of an account that owns none, named after the person: the
// instance owner's always, anyone else's while personal workspaces are on. Sign-up calls
// it, and apps/api on every request, so an account made before personal workspaces, by
// SCIM, or while they were off gets its own without signing in again. Nothing in the API
// creates a workspace; an edition that lets a person own more mounts a route of its own.
// An agent's bot user is no person.
// ponytail: an account with no workspace while they are off reads the setting on each
// request; cache it with the setting if that ever shows.
export async function ensurePersonalWorkspace(account: {
  id: string;
  role?: string | null;
}): Promise<void> {
  const userId = account.id;
  if (settled.has(userId)) return;
  if (account.role !== 'god' && !(await getAuthSettings()).personalWorkspaces) return;
  await db.transaction(async (tx) => {
    // Two sign-ins at once would otherwise both find none.
    const [person] = await tx
      .select({ name: schema.user.name, email: schema.user.email })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .for('update');
    if (!person) return;
    const [owned] = await tx
      .select({ n: sql`1` })
      .from(schema.workspaceManager)
      .where(
        and(eq(schema.workspaceManager.userId, userId), eq(schema.workspaceManager.role, 'owner')),
      )
      .limit(1);
    const [agent] = await tx
      .select({ n: sql`1` })
      .from(schema.aiAgent)
      .where(eq(schema.aiAgent.userId, userId))
      .limit(1);
    if (owned || agent) return;
    const name = (person.name.trim() || person.email.split('@')[0]!).slice(0, 60);
    await createWorkspace(tx, name, userId);
  });
  settled.add(userId);
}

// After an account stops owning a workspace (it deleted or handed over its own), so the
// next request makes it a fresh one while personal workspaces are on.
export function forgetPersonalWorkspace(userId: string): void {
  settled.delete(userId);
}

// True when an agent of some project already answers to this handle. A mention is
// resolved against members and agents at once, so the two share one namespace: a
// member cannot take a name an agent uses, and the check for the other direction
// sits where an agent is created. Agent handles are stored as typed, so the
// comparison is case-insensitive.
async function isAgentHandle(handle: string): Promise<boolean> {
  const normalized = handle.trim().toLowerCase();
  if (!normalized) return false;
  const taken = await db.$count(
    schema.aiAgent,
    eq(sql`lower(${schema.aiAgent.username})`, normalized),
  );
  return taken > 0;
}

// Nobody is asked for a username at sign-up: it is derived from the address — the
// local part, with everything the plugin's validator rejects removed — and the owner
// changes it later in the profile. A name already in use gets a random suffix, and
// the check repeats until the name is free.
export async function generateUsername(email: string): Promise<string> {
  const stem =
    email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9_.]/g, '')
      .slice(0, USERNAME_MAX_LENGTH - SUFFIX_LENGTH) || 'user';
  let candidate = stem.length >= USERNAME_MIN_LENGTH ? stem : stem + randomSuffix();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const taken =
      (await db.$count(schema.user, eq(schema.user.username, candidate))) > 0 ||
      (await isAgentHandle(candidate));
    if (!taken) break;
    candidate = stem + randomSuffix();
  }
  return candidate;
}

// Personal API key lifetime. The plugin's option is typed as milliseconds but the
// handler applies it as seconds (the same unit as the `expiresIn` a client sends),
// so it is held in seconds here. The maximum is in days, as the plugin reads it.
const DAY_SEC = 24 * 60 * 60;
export const API_KEY_DEFAULT_EXPIRES_IN_SEC = 90 * DAY_SEC;
export const API_KEY_MAX_EXPIRES_IN_DAYS = 365;

// Created on first use rather than on import, so a build's extendAuth (./extensions) takes
// effect wherever a bundler puts its module, as long as it runs before the first request.
function createAuth() {
  const extensions = readAuthExtensions();
  return betterAuth({
    baseURL,
    secret: process.env.BETTER_AUTH_SECRET,
    onAPIError: { errorURL: oauthErrorURL },

    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        passkey: schema.passkey,
        apikey: schema.apikey,
        ssoProvider: schema.ssoProvider,
        jwks: schema.jwks,
        oauthClient: schema.oauthClient,
        oauthResource: schema.oauthResource,
        oauthClientResource: schema.oauthClientResource,
        oauthRefreshToken: schema.oauthRefreshToken,
        oauthAccessToken: schema.oauthAccessToken,
        oauthConsent: schema.oauthConsent,
        oauthClientAssertion: schema.oauthClientAssertion,
        ...extensions.schema,
      },
    }),

    emailAndPassword: {
      enabled: true,
      // While this is true, sign-up answers without a session and a duplicate address
      // gets the same answer as a new one; sign-in of an unconfirmed account is
      // refused in the hook below before better-auth's own check runs.
      get requireEmailVerification() {
        return verificationRequired;
      },
      autoSignIn: true,
      // A reset is how a stolen password is dealt with, so every session opened with
      // the old one ends with it. The signed-in change-password form sends
      // revokeOtherSessions for the same reason.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendAuthEmail({
          to: user.email,
          subject: 'Reset your password',
          text: 'Use the link below to set a new password. Ignore this email if you did not ask for it.',
          url: withPublicOrigin(url),
        });
      },
    },

    emailVerification: {
      // The mail goes out on every sign-up; sendVerificationEmail below drops it when
      // the instance does not require verification.
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const settings = await getAuthSettings();
        if (!settings.requireEmailVerification) return;
        await sendAuthEmail({
          to: user.email,
          subject: 'Confirm your email address',
          text: 'Use the link below to confirm this address and finish signing up.',
          url: withPublicOrigin(url),
        });
      },
    },

    // Google sign-in. The provider is always mounted; whether it may run is decided per
    // request in the hook below, the same way the magic link is handled. The factory
    // runs once, at startup, and returns the shared options object described above.
    socialProviders: {
      google: async () => {
        await refreshGoogleOptions();
        return googleOptions;
      },
    },

    // A provider address that already has an account signs into it and gains a linked
    // account row, rather than being refused as a duplicate. By default that happens
    // only when the provider reported the address as verified and the local account
    // confirmed its own — Google always reports a verified address, an OIDC provider
    // need not, and an instance with no mail provider has no confirmed accounts at
    // all. The instance setting drops both conditions; after a successful link
    // better-auth marks the local user confirmed too.
    account: {
      accountLinking: {
        trustedProviders: resolveTrustedProviders,
        get requireLocalEmailVerified() {
          return !trustProviderEmails;
        },
      },
      // The id_token is stored unencrypted, so this covers only the access and refresh
      // tokens.
      encryptOAuthTokens: true,
    },

    // Extra column on the user table. Not client-settable (input: false) — the role
    // is decided by the create hook below.
    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: false,
          defaultValue: 'user',
          input: false,
        },
        // Deprovisioning flag, written only over SCIM while it acts on the whole instance.
        // Nullable: read it through isAccountDeactivated, which takes only `false`.
        active: {
          type: 'boolean',
          required: false,
          defaultValue: true,
          input: false,
        },
      },
    },

    // The registration gate and the verification check. Both read instance settings
    // per request, so god mode can change them without a restart.
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // Read here so the two sign-in endpoints, which also go through the
        // verification gate below, make one query instead of two.
        const passwordSettings = PASSWORD_PATHS.has(ctx.path) ? await getAuthSettings() : null;
        if (passwordSettings) verificationRequired = passwordSettings.requireEmailVerification;
        // The api will not let the switch be turned off while no OAuth provider is
        // configured, so this cannot leave an instance with no way in.
        if (passwordSettings && !passwordSettings.emailPassword) {
          throw new APIError('FORBIDDEN', {
            code: 'PASSWORD_AUTH_DISABLED',
            message: 'Password sign-in is disabled on this instance',
          });
        }

        if (ctx.path === '/sign-up/email') {
          await assertRegistrationAllowed(
            (ctx.body as { email?: string } | undefined)?.email ?? '',
            {
              addressProven: false,
            },
          );
          return;
        }

        const provider =
          ctx.path === '/sign-in/social' || ctx.path === '/link-social'
            ? (ctx.body as { provider?: string } | undefined)?.provider
            : ctx.path.startsWith('/callback/')
              ? ctx.path.slice('/callback/'.length)
              : undefined;
        // No screen links an OIDC identity to the signed-in account, and better-auth
        // already attaches a sign-in to a matching confirmed address on its own.
        if (ctx.path === '/link-social' && provider === OIDC_PROVIDER_ID) {
          throw new APIError('FORBIDDEN', { message: 'Single sign-on cannot be linked' });
        }

        // Both halves of an OAuth round trip: starting it and coming back from it. This
        // is where the stored settings are loaded into the provider, so a request never
        // runs on a value the owner has since changed. The OIDC refusal carries a code
        // because the callback turns it into the ?error= it redirects with; without one
        // the callback fails the request instead.
        if (provider === OIDC_PROVIDER_ID) {
          if (!(await refreshOidcProvider())) {
            throw new APIError('FORBIDDEN', {
              code: 'OIDC_DISABLED',
              message: 'Single sign-on is disabled on this instance',
            });
          }
          return;
        }
        if (provider === 'google') {
          if (!(await refreshGoogleOptions())) {
            throw new APIError('FORBIDDEN', {
              message: 'Google sign-in is disabled on this instance',
            });
          }
          return;
        }

        // Starting a SAML sign-in, the IdP's response, and the SP metadata. The response
        // is a form the IdP's page posts, so a refusal there goes back to the sign-in
        // screen with a code rather than as JSON.
        if (ctx.path === '/sign-in/sso' || ctx.path.startsWith('/sso/saml2/')) {
          const usable = await refreshSamlProvider();
          if (usable || ctx.path === '/sso/saml2/sp/metadata') return;
          if (ctx.path.startsWith('/sso/saml2/sp/acs/')) {
            throw ctx.redirect(`${oauthErrorURL}?error=SAML_DISABLED`);
          }
          throw new APIError('FORBIDDEN', {
            code: 'SAML_DISABLED',
            message: 'SAML sign-in is disabled on this instance',
          });
        }

        // Both password endpoints: the sign-in screen sends the one field it has to
        // /sign-in/email or /sign-in/username depending on what was typed, and the
        // instance gate has to apply either way.
        if (ctx.path === '/sign-in/email' || ctx.path === '/sign-in/username') {
          const settings = passwordSettings ?? (await getAuthSettings());
          if (!settings.requireEmailVerification) return;
          const body = ctx.body as { email?: string; username?: string } | undefined;
          const identifier =
            ctx.path === '/sign-in/email'
              ? eq(schema.user.email, (body?.email ?? '').trim().toLowerCase())
              : eq(schema.user.username, (body?.username ?? '').trim().toLowerCase());
          if (await isUnverified(identifier)) {
            throw new APIError('FORBIDDEN', {
              message: 'Confirm your email address before signing in',
            });
          }
          return;
        }

        // The profile form changes the username here. The plugin only checks it against
        // the other accounts, so the agents are checked on this side.
        if (ctx.path === '/update-user') {
          const handle = (ctx.body as { username?: string } | undefined)?.username;
          if (handle && (await isAgentHandle(handle))) {
            throw new APIError('BAD_REQUEST', {
              message: 'Username is already taken. Please try another.',
            });
          }
          return;
        }

        // A key resolves to its owner's session, so a request carrying a leaked key
        // reaches the key endpoints. It may not issue another one: a new key starts a
        // fresh lifetime, which is the expiry of the leaked key renewed under a
        // different row. Issuing a key is left to a signed-in session. The server-side
        // call that issues an agent's key carries no request and is unaffected.
        if (ctx.path === '/api-key/create' && ctx.request?.headers.get('x-api-key')) {
          throw new APIError('FORBIDDEN', {
            message: 'An API key cannot create another API key. Sign in to create one.',
          });
        }

        // The lifetime is fixed at creation for the same reason; a longer one is a new
        // key, created from a session.
        if (ctx.path === '/api-key/update') {
          const body = ctx.body as { expiresIn?: number | null } | undefined;
          if (body && body.expiresIn !== undefined) {
            throw new APIError('FORBIDDEN', {
              message: 'The expiry of an API key cannot be changed. Create a new key instead.',
            });
          }
        }
      }),
    },

    databaseHooks: {
      user: {
        create: {
          // Every account creation passes here, whichever method made it, so this is
          // where the registration gate applies to Google. Agent bot users are written
          // with a direct insert and never reach this hook.
          //
          // Assign the role before the row is inserted: first user ever → "god",
          // everyone else → "user".
          before: async (user, ctx) => {
            // The email form is refused up front unless its invite is valid, so a refusal
            // here comes from a provider or a magic link, which prove the address.
            if (!(await admittedPastGate(user.email, ctx))) {
              await assertRegistrationAllowed(user.email, { addressProven: true });
            }
            const isFirstUser = (await db.$count(schema.user)) === 0;
            // A sign-up that carried its own username has passed the plugin's own
            // check against the other accounts by now, but not the one against the
            // agents; only an account without one gets a derived name.
            const carried = typeof user.username === 'string' ? user.username : null;
            if (carried && (await isAgentHandle(carried))) {
              throw new APIError('BAD_REQUEST', {
                code: 'USERNAME_IS_ALREADY_TAKEN',
                message: 'Username is already taken. Please try another.',
              });
            }
            const derived = carried ?? (await generateUsername(user.email));
            return {
              data: {
                ...user,
                role: isFirstUser ? 'god' : 'user',
                username: derived,
                displayUsername: user.displayUsername ?? derived,
              },
            };
          },
          after: async (user) => {
            await ensurePersonalWorkspace(user);
          },
        },
      },
      session: {
        create: {
          // Every sign-in method ends here, so one check covers password, magic link,
          // passkey, Google and OIDC. Deactivation arrives over SCIM or from god mode;
          // apps/api refuses the sessions that are already open.
          before: async (session) => {
            const [account] = await db
              .select({ active: schema.user.active })
              .from(schema.user)
              .where(eq(schema.user.id, session.userId));
            if (account && isAccountDeactivated(account)) {
              throw new APIError('FORBIDDEN', {
                code: 'ACCOUNT_DEACTIVATED',
                message: 'This account is deactivated',
              });
            }
          },
        },
      },
    },

    plugins: [
      // WebAuthn passkeys, a second sign-in method alongside email + password. A
      // passkey is added to an already signed-in account (passkey.addPasskey) and
      // then used to sign in (signIn.passkey). Adds the `passkey` table.
      passkey({
        rpID: passkeyRpID,
        rpName: process.env.PASSKEY_RP_NAME ?? 'One Health',
        // Expected origin(s) of the WebAuthn ceremony — the frontend origins.
        origin: trustedOrigins,
      }),
      // Personal API keys: a signed-in user creates a named key, sees its value once
      // at creation, and can list (value hidden) or delete it. Adds the `apikey` table.
      // enableSessionForAPIKeys makes a request carrying an `x-api-key` header resolve
      // to the key owner's session, so getSession (and every planner guard built on it)
      // accepts API keys without any change in apps/api. Rate limit: 100 requests per
      // second per key (timeWindow is in milliseconds). The ceiling is set for the
      // heaviest legitimate caller rather than a typical one: an internal AI agent runs
      // on its own key and dispatches every tool call through a route, and a model that
      // emits a batch of tool calls in one step turns them into a burst of requests.
      apiKey({
        enableSessionForAPIKeys: true,
        // Brand prefix so a leaked key is identifiable by secret scanners and in logs.
        // The trailing underscore separates it from the random part (itp_<64 chars>).
        defaultPrefix: 'itp_',
        // A key is a full-account credential, so one that was forgotten stops working
        // on its own. The caller may pick a shorter or longer life up to the maximum;
        // an agent's key is the exception, cleared where it is issued in apps/api.
        keyExpiration: {
          defaultExpiresIn: API_KEY_DEFAULT_EXPIRES_IN_SEC,
          maxExpiresIn: API_KEY_MAX_EXPIRES_IN_DAYS,
        },
        rateLimit: {
          enabled: true,
          timeWindow: 1000,
          maxRequests: 100,
        },
      }),
      // Sign-in by emailed link, offered alongside the password. Whether it is
      // available is an instance setting, so the plugin is always mounted and the
      // sender refuses when it is off. It reuses the `verification` table — no new
      // table, so `auth:generate` output is unchanged.
      magicLink({
        // Stored plain, an OAuth state also passes as a token (GHSA-965c-763c-88jm).
        storeToken: 'hashed',
        sendMagicLink: async ({ email, url }) => {
          const settings = await getAuthSettings();
          if (!settings.magicLink) {
            throw new APIError('FORBIDDEN', {
              message: 'Magic links are disabled on this instance',
            });
          }
          await sendAuthEmail({
            to: email,
            subject: 'Your sign-in link',
            text: 'Use the link below to sign in. It works once and expires shortly.',
            url: withPublicOrigin(url),
          });
        },
      }),
      // The instance's OIDC provider, configured in god mode; see oidcProvider above.
      instanceOidc(),
      // The instance's SAML provider, configured in god mode; see samlProviders above.
      // Adds the `ssoProvider` table, which stays empty.
      sso({ defaultSSO: samlProviders }),
      // Usernames: a second identifier next to the address, unique across the
      // instance. Adds `username` / `display_username` to the user table and the
      // /sign-in/username endpoint the sign-in screen uses when the visitor typed a
      // name rather than an address. Nobody is asked for one — the create hook above
      // derives it from the address, and the profile page changes it afterwards.
      username({
        minUsernameLength: USERNAME_MIN_LENGTH,
        maxUsernameLength: USERNAME_MAX_LENGTH,
      }),
      // OAuth 2.1 for Streamable HTTP MCP clients, on top of the existing session. Any
      // client registers itself (RFC 7591), as ChatGPT and Claude do. The access tokens
      // are JWTs signed by jwt(); no screen reads a session JWT, so it does not put one
      // on every session response.
      ...(mcpOAuth
        ? [
            jwt({ disableSettingJwtHeader: true, jwt: { issuer: MCP_ISSUER } }),
            mcp({
              resource: MCP_RESOURCE,
              loginPage: `${trustedOrigins[0]}/login`,
              consentPage: `${trustedOrigins[0]}/oauth/consent`,
              // Every token acts for a person; client_credentials would mint one for none.
              grantTypes: ['authorization_code', 'refresh_token'],
              allowDynamicClientRegistration: true,
              allowUnauthenticatedClientRegistration: true,
            }),
          ]
        : []),
      // OpenAPI reference for the better-auth handler. Serves a Scalar UI at
      // /api/auth/reference and the raw schema at /api/auth/open-api/generate-schema.
      // The schema is built from every active plugin, so the passkey and apiKey
      // endpoints are documented automatically. This is docs-only: it adds no table,
      // so `auth:generate` is not needed. The planner's own OpenAPI docs stay at /docs.
      openAPI(),
      // A build's own (./extensions). Typed as none, so the instance's type stays the core's.
      ...(extensions.plugins as []),
    ],

    // The frontend runs on a different origin (Next :3001) — allow its requests.
    trustedOrigins,

    // /is-username-available answers for anyone, and a username is derived from the
    // address, so it would tell a stranger which addresses are registered. Nothing in
    // the app calls it — the profile form learns a name is taken from updateUser's
    // error. jwt()'s /token hands out a JWT of the session, which nothing reads.
    // The SSO plugin's provider endpoints let any signed-in user register an identity
    // provider for a domain, which would sign its addresses into existing accounts; the
    // instance's one provider is set in god mode instead.
    disabledPaths: [
      '/is-username-available',
      '/token',
      '/sso/register',
      '/sso/providers',
      '/sso/get-provider',
      '/sso/update-provider',
      '/sso/delete-provider',
      '/sso/request-domain-verification',
      '/sso/verify-domain',
      ...extensions.disabledPaths,
    ],

    advanced: {
      // Share the session cookie across subdomains when COOKIE_DOMAIN is the parent
      // domain (e.g. ".itsaplan.dev" for app.itsaplan.dev + api.itsaplan.dev). Without
      // it the cookie is host-only for the api origin, so the SSR web app on another
      // subdomain cannot read the session. Leave COOKIE_DOMAIN unset on localhost
      // (single host), where "lax" host-only cookies already work across ports.
      ...(cookieDomain
        ? {
            crossSubDomainCookies: {
              enabled: true,
              domain: cookieDomain,
            },
          }
        : {}),
      // For a single site (localhost / one domain) "lax" is enough. Subdomains of one
      // registrable domain are same-site, so "lax" cookies are still sent between them.
      ...(hostPrefixedCookies
        ? {
            useSecureCookies: false,
            cookiePrefix: '__Secure-better-auth',
            cookies: Object.fromEntries(
              SESSION_COOKIES.map((name) => [
                name,
                { name: `__Host-better-auth.${name}`, attributes: { path: '/', secure: true } },
              ]),
            ),
          }
        : {}),
      defaultCookieAttributes: {
        sameSite: 'lax',
        secure: hostPrefixedCookies || process.env.NODE_ENV === 'production',
      },
    },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;
const instanceOf = () => (instance ??= createAuth());

export const auth = new Proxy({} as ReturnType<typeof createAuth>, {
  get: (_target, key) => Reflect.get(instanceOf(), key),
  has: (_target, key) => Reflect.has(instanceOf(), key),
});

export type Auth = typeof auth;
export type Session = Auth['$Infer']['Session'];

// A key the apiKey plugin will not accept — expired, revoked or malformed — makes
// it throw out of getSession instead of returning no session, which a caller can
// only report as a 500. Such a request carries no session, so it is answered as
// one, and a key that reached its expiry is refused like any other unauthenticated
// request. A refusal for another reason, a rate-limited key among them, still
// propagates: it is not the same answer.
export async function getSessionFromHeaders(
  headers: Headers,
): Promise<Awaited<ReturnType<typeof auth.api.getSession>>> {
  try {
    return await auth.api.getSession({ headers });
  } catch (error) {
    if (error instanceof APIError && (error.statusCode === 401 || error.statusCode === 403)) {
      return null;
    }
    throw error;
  }
}

// Instance-wide authentication settings (registration mode, mail provider, invite
// links). Read here by the sign-up gate and the mail senders; managed over HTTP by
// god mode in apps/api.
export {
  REGISTRATION_MODES,
  getAuthSettings,
  setAuthSettings,
  emailDomainAllowed,
  registrationEmailAllowed,
  setRegistrationEmailPolicy,
  setRegistrationAdmission,
  inviteValidSince,
  getEmailSettings,
  setEmailSettings,
  resolveEmailConfig,
  getGoogleSettings,
  setGoogleSettings,
  getGoogleConfig,
  hasConfiguredGoogle,
  getOidcSettings,
  setOidcSettings,
  getOidcConfig,
  getOidcLabel,
  hasConfiguredOidc,
  getSamlConfig,
  setSamlSettings,
  getSamlLabel,
  hasConfiguredSaml,
  getScimSettings,
  setScimSettings,
  rotateScimToken,
  verifyScimToken,
  setWorkspaceScim,
  workspaceScim,
  workspacesWithOwnScim,
  isAccountDeactivated,
  accountsManagedByScim,
} from './instance';
export type {
  RegistrationMode,
  AuthSettings,
  InstanceEmailDto,
  InstanceEmailPatch,
  InstanceGoogleDto,
  InstanceGooglePatch,
  InstanceGoogleConfig,
  InstanceOidcDto,
  InstanceOidcPatch,
  InstanceOidcConfig,
  InstanceSamlConfig,
  InstanceSamlPatch,
  ScimSettingsDto,
} from './instance';
export { parseIdpMetadata, SamlMetadataError, type IdpMetadataSummary } from './saml';
