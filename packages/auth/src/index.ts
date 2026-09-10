import { randomInt } from 'node:crypto';
import { db, defaultMemberPermissions } from '@repo/db';
import { eq, sql, type SQL } from 'drizzle-orm';
import { betterAuth } from 'better-auth';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { passkey } from '@better-auth/passkey';
import { apiKey } from '@better-auth/api-key';
import { mcp, openAPI, magicLink, username, genericOAuth } from 'better-auth/plugins';
import type { GenericOAuthConfig } from 'better-auth/plugins/generic-oauth';
import * as schema from '@repo/db/schema';
import {
  getAuthSettings,
  hasPendingInvite,
  getGoogleConfig,
  isGoogleUsable,
  getOidcConfig,
  isOidcUsable,
} from './instance';
import { sendAuthEmail } from './mail';

// Frontend origins allowed to call the auth handler. Mandatory config: cookies, the
// WebAuthn relying party and the cookie domain are all derived from it, so a deploy
// that misses it has to fail at startup instead of running on a localhost default.
export const trustedOrigins = (process.env.APP_URL ?? '')
  .split(',')
  .map((origin) => origin.trim())
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

// Explicit COOKIE_DOMAIN wins (needed for multi-label TLDs or deep subdomains);
// otherwise derive it from the frontend origin.
const cookieDomain = process.env.COOKIE_DOMAIN || parentDomain(trustedOrigins[0]);

// WebAuthn relying-party id: the frontend domain the passkey is bound to (no port,
// no scheme). The WebAuthn ceremony runs in the frontend JS, so the expected origin
// is the frontend origin(s) — the same trustedOrigins list. On localhost this all
// works over http (localhost is a secure context). In prod set PASSKEY_RP_ID to the
// public frontend hostname.
const passkeyRpID = process.env.PASSKEY_RP_ID ?? new URL(trustedOrigins[0]).hostname;

// Backend origin where the better-auth handler is mounted (/api/auth/*). Mandatory:
// every link in an authentication email and the Google redirect URI are built from it.
const baseURL = process.env.API_URL;
if (!baseURL) {
  throw new Error('API_URL is not set: public origin of the backend.');
}

// User roles. "god" is the owner of the instance: the very first registered user
// gets it automatically; everyone after is a plain "user". The role is assigned
// server-side (input: false) so a client cannot request it at sign-up.
export const USER_ROLES = ['god', 'user'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Google OAuth credentials live in the database (god mode), not in env. The provider
// is built once at startup, but it keeps this options object by reference and reads
// clientId / clientSecret off it on every call, so refreshing the object per request
// is what lets the owner change or revoke the credentials without a restart.
const googleOptions = { clientId: '', clientSecret: '' };

// The exact value that has to be registered as an authorized redirect URI in the
// Google Cloud console. better-auth derives it from baseURL; god mode shows it so the
// owner can copy it instead of assembling it by hand.
export const GOOGLE_REDIRECT_URI = `${baseURL}/api/auth/callback/google`;

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
// the `account` rows store, and better-auth materialises the provider list once at
// startup — the config array can neither grow nor be re-keyed afterwards. As with
// Google, the plugin keeps this object by reference and reads its fields on every
// call, so refreshing it per request is what lets the owner change the credentials
// without a restart. Assign the fields, never replace the object.
export const OIDC_PROVIDER_ID = 'oidc';

const oidcOptions: GenericOAuthConfig = {
  providerId: OIDC_PROVIDER_ID,
  clientId: '',
  clientSecret: '',
  discoveryUrl: '',
  scopes: [],
  pkce: true,
};

// The exact value that has to be registered as a redirect URI with the identity
// provider. god mode shows it so the owner can copy it instead of assembling it.
export const OIDC_REDIRECT_URI = `${baseURL}/api/auth/oauth2/callback/${OIDC_PROVIDER_ID}`;

// Loads the stored credentials into that object and reports whether OIDC sign-in can
// run. A read failure disables the provider rather than failing the request with a
// stale secret.
async function refreshOidcOptions(): Promise<boolean> {
  try {
    const config = await getOidcConfig();
    oidcOptions.clientId = config.clientId;
    oidcOptions.clientSecret = config.clientSecret;
    oidcOptions.discoveryUrl = config.discoveryUrl;
    oidcOptions.scopes = config.scopes;
    oidcOptions.pkce = config.pkce;
    return isOidcUsable(config);
  } catch (error) {
    console.error('[auth] could not read the OIDC credentials:', error);
    return false;
  }
}

// The two conditions better-auth checks before linking an address to an account that
// already has it are read from different places: `trustedProviders` per request,
// through the resolver below, and `requireLocalEmailVerified` off the options object
// at the moment of the decision. The resolver runs first, in the same request, and
// leaves the setting here for the getter to read.
let trustProviderEmails = false;

// The trusted providers for one request. The settings are read on the OAuth callback
// only — the resolver runs on every request to the auth API, and a session check has
// no linking decision to make.
async function resolveTrustedProviders(request?: Request): Promise<string[]> {
  if (!request || !new URL(request.url).pathname.includes('/callback/')) return [];
  trustProviderEmails = (await getAuthSettings()).trustProviderEmails;
  return trustProviderEmails ? ['google', OIDC_PROVIDER_ID] : [];
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
  '/forget-password',
  '/reset-password',
  '/sign-in/magic-link',
  '/magic-link/verify',
]);

// The registration gate: who may create an account. Both sign-up paths run it — the
// email form checks it up front (below), and the user create hook catches every other
// path, which is what stops a Google sign-up on a closed or invite-only instance.
// Each refusal carries a `code`, which is what the social callback turns into the
// ?error= it redirects with; without one the callback would fail the request instead.
async function assertRegistrationAllowed(email: string): Promise<void> {
  const settings = await getAuthSettings();
  if (settings.registration === 'closed') {
    throw new APIError('FORBIDDEN', {
      code: 'REGISTRATION_CLOSED',
      message: 'Registration is closed on this instance',
    });
  }
  if (settings.registration === 'invite' && !(await hasPendingInvite(email))) {
    throw new APIError('FORBIDDEN', {
      code: 'INVITE_ONLY',
      message: 'This instance is invite-only. Ask a project owner to invite this address.',
    });
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

export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      passkey: schema.passkey,
      apikey: schema.apikey,
      oauthApplication: schema.oauthApplication,
      oauthAccessToken: schema.oauthAccessToken,
      oauthConsent: schema.oauthConsent,
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
        url,
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
        url,
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
      // Deprovisioning flag, written only over SCIM. Nullable, so every check is
      // `active !== false` — an account that predates the column has no value.
      active: {
        type: 'boolean',
        required: false,
        defaultValue: true,
        input: false,
      },
      // The identity provider's own id for this account, used by SCIM to correlate
      // a user it did not create the id for.
      scimExternalId: {
        type: 'string',
        required: false,
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
        await assertRegistrationAllowed((ctx.body as { email?: string } | undefined)?.email ?? '');
        return;
      }

      // Both halves of the OIDC round trip. The refusal carries a code because the
      // callback turns it into the ?error= it redirects with; without one the
      // callback fails the request instead.
      if (ctx.path === '/sign-in/oauth2' || ctx.path.startsWith('/oauth2/callback/')) {
        if (!(await refreshOidcOptions())) {
          throw new APIError('FORBIDDEN', {
            code: 'OIDC_DISABLED',
            message: 'Single sign-on is disabled on this instance',
          });
        }
        return;
      }

      // Both halves of the Google round trip: starting it and coming back from it.
      // This is where the stored credentials are loaded into the provider's options,
      // so a request never runs on a value the owner has since changed.
      if (ctx.path === '/sign-in/social' || ctx.path.startsWith('/callback/google')) {
        if (!(await refreshGoogleOptions())) {
          throw new APIError('FORBIDDEN', {
            message: 'Google sign-in is disabled on this instance',
          });
        }
        return;
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
        before: async (user) => {
          await assertRegistrationAllowed(user.email);
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
        // A project belongs to a team, so an account owns one from the moment it is
        // created, named after the username the hook above settled on. The team is
        // also where the roles its projects assign live, so it starts with the
        // default one.
        after: async (created) => {
          const handle = typeof created.username === 'string' ? created.username : created.name;
          await db.transaction(async (tx) => {
            const [row] = await tx
              .insert(schema.team)
              .values({ name: handle })
              .returning({ id: schema.team.id });
            await tx
              .insert(schema.teamMember)
              .values({ teamId: row.id, userId: created.id, role: 'owner' });
            await tx.insert(schema.teamRole).values({
              teamId: row.id,
              name: 'Member',
              isDefault: true,
              permissions: defaultMemberPermissions(),
            });
          });
        },
      },
    },
    session: {
      create: {
        // Every sign-in method ends here, so one check covers password, magic link,
        // passkey, Google and OIDC. Deactivation arrives over SCIM; apps/api refuses
        // the sessions that are already open.
        before: async (session) => {
          const rows = await db
            .select({ active: schema.user.active })
            .from(schema.user)
            .where(eq(schema.user.id, session.userId));
          if (rows[0]?.active === false) {
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
      rpName: process.env.PASSKEY_RP_NAME ?? "It's a Plan",
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
      sendMagicLink: async ({ email, url }) => {
        const settings = await getAuthSettings();
        if (!settings.magicLink) {
          throw new APIError('FORBIDDEN', { message: 'Magic links are disabled on this instance' });
        }
        await sendAuthEmail({
          to: email,
          subject: 'Your sign-in link',
          text: 'Use the link below to sign in. It works once and expires shortly.',
          url,
        });
      },
    }),
    // A single generic OIDC/OAuth2 provider, configured by the instance owner and
    // discovered from its well-known document. Adds /sign-in/oauth2 and
    // /oauth2/callback/:providerId; it reuses the `account` table, so it adds none.
    // The config array is materialised at startup — see oidcOptions above for why
    // there is exactly one entry and why its fields are mutated rather than replaced.
    genericOAuth({ config: [oidcOptions] }),
    // Usernames: a second identifier next to the address, unique across the
    // instance. Adds `username` / `display_username` to the user table and the
    // /sign-in/username endpoint the sign-in screen uses when the visitor typed a
    // name rather than an address. Nobody is asked for one — the create hook above
    // derives it from the address, and the profile page changes it afterwards.
    username({
      minUsernameLength: USERNAME_MIN_LENGTH,
      maxUsernameLength: USERNAME_MAX_LENGTH,
    }),
    // Native OAuth 2.1 provider for Streamable HTTP MCP clients. It uses the
    // existing Better Auth session, requires PKCE, and supports dynamic public
    // clients such as ChatGPT without exposing a personal API key.
    mcp({
      loginPage: `${trustedOrigins[0]}/login`,
      resource: `${baseURL}/mcp`,
      oidcConfig: {
        loginPage: `${trustedOrigins[0]}/login`,
        requirePKCE: true,
        consentPage: `${trustedOrigins[0]}/oauth/consent`,
      },
    }),
    // OpenAPI reference for the better-auth handler. Serves a Scalar UI at
    // /api/auth/reference and the raw schema at /api/auth/open-api/generate-schema.
    // The schema is built from every active plugin, so the passkey and apiKey
    // endpoints are documented automatically. This is docs-only: it adds no table,
    // so `auth:generate` is not needed. The planner's own OpenAPI docs stay at /docs.
    openAPI(),
  ],

  // The frontend runs on a different origin (Next :3001) — allow its requests.
  trustedOrigins,

  // /is-username-available answers for anyone, and a username is derived from the
  // address, so it would tell a stranger which addresses are registered. Nothing in
  // the app calls it — the profile form learns a name is taken from updateUser's
  // error. /oauth2/link attaches an OIDC identity to the signed-in account, which no
  // screen offers: better-auth already links a sign-in to a matching confirmed
  // address on its own.
  disabledPaths: ['/is-username-available', '/oauth2/link'],

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
    defaultCookieAttributes: {
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  },
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
  getScimSettings,
  setScimSettings,
  rotateScimToken,
  isScimEnabled,
  verifyScimToken,
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
  InstanceScimDto,
} from './instance';

export {
  withMcpAuth,
  oAuthDiscoveryMetadata,
  oAuthProtectedResourceMetadata,
} from 'better-auth/plugins';
