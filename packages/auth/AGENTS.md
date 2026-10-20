# @repo/auth

The **server-side** better-auth instance. Consumed by `apps/api`. See root `AGENTS.md`.

- `src/index.ts` — `export const auth = betterAuth({...})` with the Drizzle adapter
  (`provider: "pg"`) over `@repo/db`. Email+password enabled (`autoSignIn: true`;
  whether the address has to be confirmed first is an instance setting, see below),
  plus the WebAuthn passkey plugin (`@better-auth/passkey`).
- Exports `auth`, `USER_ROLES` / `UserRole`, `generateUsername` (the SCIM module derives a
  handle with the same rule), `getSessionFromHeaders`, plus `Auth` / `Session` types.
- `emailAndPassword.revokeSessionsOnPasswordReset` is `true`: a reset ends every session
  of that account, since a reset is how a stolen password is dealt with. The signed-in
  change-password form in the web app sends `revokeOtherSessions` for the same reason.

## User role

The user table has a `role` column (`"god"` | `"user"`), declared as a better-auth
`additionalField` with `input: false` (not client-settable). A `databaseHooks.user.create.before`
hook sets it: the first user to register gets `"god"`, everyone after gets `"user"`.
`databaseHooks.user.create.after` gives the account a workspace of its own, named after
the person (`ensurePersonalWorkspace`): the `"god"` account always, every other account
while `personalWorkspaces` is on in the auth settings. apps/api
calls the same function on every request, so an account made before, by SCIM (a direct
insert, which passes no hook) or while the setting was off gets its own on its next
request. It remembers per process who needs nothing, so a request costs a lookup; an
agent's bot user never gets one.

## Instance settings (`src/instance.ts`)

Registration mode, which sign-in methods are offered, the mail provider, the OAuth
credentials and the SCIM token are stored in the database, not in env, so god mode and the
workspace settings can change them without a restart. Read them
through this module — never inline a query on `app_setting` / `app_secret` elsewhere.

- `app_setting` key `auth` → `{ registration, requireEmailVerification, magicLink,
  emailPassword, trustProviderEmails, personalWorkspaces, inviteTtlDays,
  allowedEmailDomains }`.
- `app_secret` keys `auth.email`, `auth.google`, `auth.oidc` and `auth.scim` → the mail
  provider, Google, the OIDC provider and the instance's SCIM token, set in god mode;
  `workspace.<id>.scim` → a workspace's SCIM token, set by the workspace owner. All encrypted with `@repo/crypto`, each with a `redacted`
  mirror for the settings UI. Secrets never leave the server.

The mail provider is read by the api and the worker as well, so its shape and reader
live in `@repo/db` (`domains/instance-email.ts`); what is here is the write side god
mode drives.

"Invite only" means the address has a pending `team_invite` that has not expired
(`hasPendingInvite`). An invite expires `inviteTtlDays` after it was created (7 by
default, 0 for never, at most 3650; `inviteValidSince` gives the cutoff): it then neither gates
registration nor can be accepted, and a new invite for the same address replaces it.
Invites are created and revoked inside a team, so there is no instance-level invite
table and god mode has no invite section — do not add one; god mode only sets how long
they last.

`hooks.before` gates `/sign-up/email` (closed → 403, an address outside
`allowedEmailDomains` → 403, invite → no pending, unexpired invite for that address → 403)
and holds back `/sign-in/email` for an unconfirmed address while verification is required, with 403
`EMAIL_NOT_VERIFIED`, better-auth's own code for it. The sign-in form reads that code to offer the
confirmation link again; a deactivated account and a disabled password form are 403s too. The requirement never outlives the mail provider: the api
refuses to turn it on without one, and `setEmailSettings` clears it when the provider
is removed, so the setting alone is what the gate, the sign-up endpoint and the
public `/auth-config` read — none of them checks the provider again.

`emailAndPassword.requireEmailVerification` is a getter over a module variable that
`hooks.before` refreshes from the setting on every password endpoint. better-auth
reads the option off the options object when `/sign-up/email` decides whether to
open a session, so this is what makes a required confirmation answer sign-up with
`token: null` and no cookie instead of a working session. Do not replace the getter
with a static value: `true` would lock every account out the moment the setting is
turned off, and `false` hands an unconfirmed sign-up a session.

Authentication email (`src/mail.ts`) goes out through `@repo/mailer` and is best
effort: with no provider configured it logs and returns false rather than failing the
request. Three kinds are sent: password reset, address confirmation, and the magic
link. Every link must carry a `callbackURL`/`redirectTo` on the **web** origin — the
handler runs on the API origin, so a link built without one lands the reader on the
API, which renders nothing. The web app passes them in `features/auth/services`.

With confirmation required, sign-up returns the user and no session; the web sign-up
shows a "confirm your email" screen instead of entering the app, and the link opens
the session (`autoSignInAfterVerification`).

## Username

The `username()` plugin adds `username` / `display_username` to the user table and the
`/sign-in/username` endpoint. Nobody is asked for a name: `databaseHooks.user.create.before`
derives one from the address — the local part, with everything the plugin's validator
rejects removed — and appends three random digits when that name is taken or is shorter
than the 3-character minimum. The owner changes it afterwards through `updateUser`, which
is where the plugin enforces uniqueness. Accounts that predate the column are filled in by
`drizzle/0087_username_backfill.sql`, which repeats the same rule in SQL; agent bot users
are skipped there, and their direct insert never reaches the hook, so their username stays
NULL.

A username also addresses an agent in a mention, and a mention is resolved against the
project's members and its agents at once, so the two share one namespace. Every path that
sets a member's name checks it against `ai_agent`: `hooks.before` refuses an `/update-user`
that takes a name an agent already uses, `databaseHooks.user.create.before` refuses a
sign-up that carried one, and `generateUsername` skips such a name. The check for the other
direction sits in the api, where an agent is created or renamed.

The plugin's `/is-username-available` is in `disabledPaths` and answers 404. It takes no
session, and a username comes from the address, so it would tell a stranger which
addresses are registered.

The sign-in screen has one field for both identifiers and picks the endpoint by whether
what was typed contains an "@". The instance verification gate in `hooks.before`
covers `/sign-in/username` as well as `/sign-in/email`, and runs before the plugin's
own check of `emailAndPassword.requireEmailVerification`.

## Generic OIDC

One OIDC/OAuth2 provider, discovered from the well-known document the operator points it
at in god mode (`app_secret` key `auth.oidc`). It is a social provider with the id
`OIDC_PROVIDER_ID` (`"oidc"`): sign-in is `/sign-in/social` with that provider, the
callback is `/callback/oidc`, and it reuses the `account` table, so it adds none.

A provider per workspace is not built on this one. A sign-in through it joins the account
that already holds the address, which is safe only because the provider is the instance
owner's: a workspace owner's provider could name any address. It needs the workspace to
prove it owns the address's domain first, and is left to a hosted module, which adds its
settings section through `useWorkspaceSections` in the web app's `@/cloud` seam.

`providerId` is a constant because it is what the `account` rows store, and the rows hold
the OIDC `sub` (`accountSubject`). genericOAuth reads the discovery document once, when
its plugin starts, while this provider changes in god mode without a restart. So
better-auth holds a proxy (`oidcProvider`, registered by the `instanceOidc` plugin), and
`refreshOidcProvider()` in `hooks.before` builds the real provider with genericOAuth from
the stored settings whenever they change, on both halves of the round trip.

The redirect URI registered with the identity provider is `OIDC_REDIRECT_URI`,
`/api/auth/oauth2/callback/oidc`. The api passes that path on to better-auth's
`/api/auth/callback/oidc`, so the URI the identity providers hold stays valid.

Signing out leaves the session at the identity provider alone (`disableProviderLogout`).
No screen offers linking an OIDC identity to the signed-in account, so `hooks.before`
refuses `/link-social` for it; better-auth already attaches a sign-in to a matching
confirmed address on its own.

## Turning password authentication off

`AuthSettings.emailPassword` (default `true`). When it is off, the first branch of
`hooks.before` refuses every path in `PASSWORD_PATHS` — the two sign-in endpoints, sign-up,
password reset, and both halves of the magic link, so a link issued before the switch was
flipped cannot still be redeemed. Passkeys stay available: a passkey is only ever added to
an account that already exists.

Like every other instance setting this is read per request, so it cannot be
`emailAndPassword.enabled: false` (evaluated at startup) and cannot live in `disabledPaths`
(a static array). The api refuses to turn it off while neither Google nor OIDC is usable,
which is what stops an instance being left with no way in.

## SCIM

What a provider says about a person is kept per provider in `scim_user`, written by
`apps/api`. The instance's provider is set up in god mode and stored with `workspace_id`
null; a hosted build also lets every workspace set up its own with `setWorkspaceScim()`
(`workspaceScim()` reads it). The instance's provider writes `active`, one more
`additionalField` on the user table (nullable, so every check is `active !== false`).
God mode writes `active` too, from the users table, while that provider does not manage
accounts (`accountsManagedByScim`: its SCIM on with a token); while it does, `apps/api`
answers god's switch with 409. An account with `active` false (`isAccountDeactivated`) is
refused at sign-in by the `session.create.before` hook with `ACCOUNT_DEACTIVATED`, which
covers every sign-in method at once; `apps/api` refuses the sessions and keys it already
holds. A workspace's provider decides who is in the workspace, not who has an account;
`active` is not written for it, and nothing here refuses a session.

`getScimSettings` / `rotateScimToken` / `verifyScimToken` take the workspace, or null for the
instance, and hold the bearer token the SCIM endpoints in `apps/api` authenticate with. The
instance's is stored under `auth.scim` and reads `scim_<secret>`; one it held while it
belonged to the first workspace reads `scim_<id>_<secret>` and keeps working. A workspace's
is stored under `workspace.<id>.scim` and reads `scim_<workspaceId>_<secret>`, so
`verifyScimToken` checks the instance's first and then reads only the named workspace's.
The token is returned in the clear exactly once, when it is generated; only its prefix is
kept in the redacted mirror.

## Passkey

`passkey({ rpID, rpName, origin })` adds WebAuthn. `rpID` is the frontend hostname the
credential binds to — derived from the first `APP_URL` entry, overridable with
`PASSKEY_RP_ID` (set it to the public frontend hostname in prod). `origin` is the whole
`APP_URL` list (the WebAuthn ceremony runs in the frontend JS). The plugin adds
the `passkey` table, which is mapped in the drizzle adapter's `schema`. localhost is a
secure context, so passkeys work over http in dev.

## Google sign-in

The credentials live in the database (`app_secret` key `auth.google`, encrypted), not in
env, so god mode can change them without a restart. That is the only reason the provider
is wired the way it is:

`socialProviders.google` is a factory that returns the module-level `googleOptions`
object. better-auth builds the provider list once at startup, but the provider keeps that
object **by reference** and reads `clientId` / `clientSecret` off it on every call, so
`refreshGoogleOptions()` in `hooks.before` reloads it on `/sign-in/social` and
`/callback/google` and refuses the request when the credentials are missing or the toggle
is off. Do not replace the object (`googleOptions = {...}`) — assign its fields, or the
provider keeps reading the old one.

Account linking is left at better-auth's defaults, which means
`accountLinking.requireLocalEmailVerified` is `true`: a Google address that already has an
account signs into it only when that account's email is confirmed, and gets
`unable_to_link_account` otherwise. Do not add `trustedProviders: ['google']` — with
instance email confirmation optional, it would let whoever registered an address first
receive its real owner.

The registration gate (`assertRegistrationAllowed`) runs in
`databaseHooks.user.create.before`, which every account creation passes, and that is what
applies closed/invite-only to a Google, OIDC or magic-link sign-up. It refuses with
`REGISTRATION_CLOSED` on a closed instance, `EMAIL_DOMAIN_NOT_ALLOWED` when the address is
not at one of `allowedEmailDomains` (an empty list admits any), `INVITE_ONLY` when the
address has no pending invite, and `INVITE_EXPIRED` when its only invites have expired.
That last one reveals that the address was invited, so it is given only where the address
is proven (provider, magic link); the email form, open to anyone, gets `INVITE_ONLY`. Its
`APIError`s carry a `code` because the provider callback and the magic link turn that into
the `?error=` they redirect with; without one the callback fails the request instead
(`invite-forms.test.ts` pins `INVITE_EXPIRED` and `INVITE_ONLY`). Agent bot users are
written with a direct insert and never reach the hook.

A domain in `allowedEmailDomains` matches the part of the address after the "@" exactly, so
a subdomain is listed on its own. The list applies to new accounts only; the api also
refuses to invite an address that has no account and is outside it, since it could not
register. The gate asks `registrationEmailAllowed`, which checks the list unless a build
installs its own policy with `setRegistrationEmailPolicy`, as one that lets a workspace
keep domains of its own does to admit an address that workspace invited.

## API keys

`apiKey({ enableSessionForAPIKeys: true })` makes an `x-api-key` header resolve to the
owner's session, so a key is a full-account credential. It therefore expires:
`keyExpiration.defaultExpiresIn` is 90 days and `maxExpiresIn` is a year, and the create
dialog in the web app offers 30/90/180/365 days. The plugin's option is documented as
milliseconds but its handler passes the value to `getDate(value, "sec")`, so
`API_KEY_DEFAULT_EXPIRES_IN_SEC` is in seconds; `maxExpiresIn` is in days, as the plugin
reads it. Keys issued before this stay `expires_at` NULL and keep working.

The expiry only holds if a key cannot renew itself, and a request carrying one resolves to
the owner's session on every key endpoint. So `hooks.before` refuses both ways round it: an
`/api-key/update` that carries `expiresIn`, and an `/api-key/create` sent with an
`x-api-key` header. Keys are issued from a signed-in session; a longer life is a new key.
The refusal reads `ctx.request`, which a server-side `auth.api.createApiKey` does not
carry, so `issueKey` is unaffected.

An agent's key is the exception and carries no expiry — an agent replays its stored secret
with nothing that would renew it, and an external agent's operator rotates it through
`regenerate-key`. The plugin applies the default to every key it creates, so `issueKey` in
`apps/api/src/modules/agents/core/service.ts` clears `expires_at` on the row afterwards.

A key the plugin will not accept makes it throw out of `auth.api.getSession` rather than
return no session. `getSessionFromHeaders` turns that back into "no session", so an expired
key is answered with a 401 instead of a 500. Use it instead of `auth.api.getSession` where
a request may carry a key.

## MCP OAuth

`mcp()` from `@better-auth/mcp` serves OAuth 2.1 to MCP clients, with `jwt()` signing the
access tokens. It adds the `oauth_client`, `oauth_resource`, `oauth_client_resource`,
`oauth_refresh_token`, `oauth_access_token`, `oauth_consent`, `oauth_client_assertion`
and `jwks` tables, and writes the MCP resource (`<API_URL>/mcp`) into `oauth_resource`
at startup. Any client registers itself (RFC 7591), as ChatGPT and Claude do; the
provider asks the person for consent the first time a client asks for their account.
Only `authorization_code` and `refresh_token` are granted, so every token acts for a
person. A registration that also lists a grant the server does not issue, as Claude's
connector does with `jwt-bearer`, is registered with the supported grants; one that lists
none of them is refused.

MCP clients register without `application_type`, and `mcp()` infers it
(`clientRegistrationDefaultApplicationType: 'infer'`): a client whose callback is http on
`localhost`, `127.0.0.1` or `[::1]` (Claude Code) or uses a custom scheme such as Cursor's
`cursor://` is registered as `native`, and any other as `web`, which takes an https callback
only. better-auth's own default, `web`, refuses the first two. A client that sends its
`application_type` keeps it.

The issuer is `API_URL` itself, path included, so the tokens and the discovery documents
name the URL a client reaches. The api serves the documents at the root of its origin
(`oauthAuthorizationServerMetadata`, `openIdConfiguration`,
`oauthProtectedResourceMetadata`), and the endpoints in them get the path back the way the
links in auth emails do.

`verifyMcpAccessToken` checks a token against the instance's own keys in-process, then
reads what a JWT cannot carry: the account must not be deactivated, and a token issued in
a session ends with that session, as better-auth's introspection has it. That is what
makes deactivation, which deletes the sessions, end every MCP token at once. The token's
client must also still be connected to the account, through the person's consent or a
refresh token that has not expired: disconnecting it on the account's Security page
(`DELETE /account/connected-apps/:clientId`, which deletes both) ends its tokens at once.

better-auth accepts a plain-HTTP MCP resource only on a loopback host, so any other
instance without HTTPS leaves `mcp()` and `jwt()` out and serves MCP to personal API keys
only.

## OpenAPI reference

The `openAPI()` plugin (`better-auth/plugins`) documents the auth handler. It serves a
Scalar UI at `/api/auth/reference` and the raw schema at
`/api/auth/open-api/generate-schema`. The schema is built from every active plugin, so
the passkey and apiKey endpoints appear without any manual description. This is separate
from the planner's own OpenAPI docs at `/docs` (the `@elysiajs/swagger` spec, which does
not see the catch-all auth handler). Docs-only: it adds no table, so `auth:generate` is
not required for it.

## What a build adds

`@repo/auth/extensions` is the one module of this package that does not create the
instance. A build calls `extendAuth({ plugins, schema, disabledPaths })` from it before
the first request: the plugins join the core's, their drizzle tables join the adapter's
schema by model name, and the paths are refused to requests while the server still calls
them through `auth.api`. `./index.ts` creates the instance on its first use, not on
import, so the call takes effect wherever a bundler puts the build's module; it reads the
extensions then, and a later call throws. A plugin that needs origins trusted adds them
itself, through its `init`. The plugins are typed as none, so `Auth` stays the core's
type.

`setRegistrationAdmission(fn)` is a build's say on an account the gate is about to create,
by the request creating it (the better-auth endpoint context): true lets it past the
registration mode and the allowed domains, as a sign-in through a provider the build
manages that may create accounts; a throw turns it away. Without one the gate decides.

## Rules

- This package is **server-only** — never import a client SDK (`better-auth/react`) here;
  the web app owns its own `auth-client.ts`.
- Changing the config (plugins, fields) can change the DB tables → run `bun run auth:generate`
  (writes `packages/db/src/schema/auth.ts`), then `db:generate` + `db:migrate`.
- Config is env-driven: `API_URL` (public URL of the backend), `BETTER_AUTH_SECRET`,
  `APP_URL` (frontend origin(s), comma-separated). `API_URL` and `APP_URL` are mandatory
  and have no default — importing this module throws when either is missing. Do not add
  a localhost fallback: cookies, the passkey relying party, the cookie domain and every
  link in an authentication email are derived from them, so a wrong value fails silently
  at runtime instead of at startup. The parsed `trustedOrigins` list (from `APP_URL`) is
  exported so the api's CORS uses the same value.
- **`API_URL` with a path** (the api under a path of the web's host): better-auth's
  `baseURL` gets only the origin, because a path there replaces its `/api/auth` base path
  and the api's fixed mount stops matching. Every public URL built from it — the OAuth
  redirect URIs, the links in auth emails, the MCP resource and discovery documents — gets
  the path back through `apiPublicUrl` / `withPublicOrigin`.
- **Cookies:** `sameSite: "lax"`. Web and api on sibling subdomains share the cookie through
  `advanced.crossSubDomainCookies` on the parent domain of `APP_URL` (`COOKIE_DOMAIN`
  overrides it). On one host the cookie has no domain, and over HTTPS the session cookies
  are named `__Host-better-auth.*`. If frontend/backend run on different domains, switch
  to `sameSite: "none"` + `secure: true`.
