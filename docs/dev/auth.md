# @repo/auth: how it works

The rules are in `packages/auth/AGENTS.md`.

- `src/index.ts` builds the better-auth instance in `createAuth()`, with the Drizzle adapter
  (`provider: "pg"`) over `@repo/db`. `auth` is a proxy that calls `createAuth()` on first use.
  Email+password is enabled (`autoSignIn: true`; whether the address has to be confirmed first
  is an instance setting, see below).
- The plugins are passkey (`@better-auth/passkey`), API key, magic link, username, the instance
  OIDC provider, `jwt()` and `mcp()` (HTTPS or a loopback host only), and `openAPI()`.
- `emailAndPassword.revokeSessionsOnPasswordReset` is `true`: a reset ends every session of that
  account, since a reset is how a stolen password is dealt with. The signed-in change-password
  form in the web app sends `revokeOtherSessions` for the same reason. Neither touches personal
  API keys or an MCP client's refresh tokens.

## User role

The user table has a `role` column (`"god"` | `"user"`), declared as a better-auth
`additionalField` with `input: false` (not client-settable). A `databaseHooks.user.create.before`
hook sets it: the first user to register gets `"god"`, everyone after gets `"user"`.

`databaseHooks.user.create.after` calls `ensurePersonalWorkspace`, which gives an account that
owns no workspace one named after the person: the `"god"` account always, every other account
while `personalWorkspaces` is on in the auth settings. `authContext` in apps/api calls the same
function on every authenticated planner request, and an MCP tool call reaches a planner route.
So an account made by SCIM (a direct insert, which passes no hook), made while the setting was
off, or left with no workspace after deleting or handing over its own gets one on its next such
request, while the setting is on. `/me` does not pass through `authContext`. An agent's bot user
never gets one.

Each process keeps a set of accounts that need nothing (`settled`), so for them a request costs
no query. `forgetPersonalWorkspace` removes an account from the set in that process only. With
the setting off, a non-god account outside the set reads `app_setting` on each request.

`lastSeenAt` is another `additionalField`, with `input: false` and `returned: false`, so
better-auth leaves it out of a cookie session's response. A user loaded for an API key or an MCP
token still holds it, and the `/me` response leaves it out. apps/api writes it in the same
`authContext` step, at most once an hour per account, whether the request came with a session,
an API key or an MCP OAuth token. `/me` writes nothing. god's users list shows it as "Last seen".
Sessions are deleted on sign-out, so they are no record of when someone last used the app.

## Instance settings (`src/instance.ts`)

Registration mode, which sign-in methods are offered, the mail provider, the OAuth credentials
and the SCIM token are stored in the database, so god mode can change them without a restart.
The mail From address falls back to env (`EMAIL_FROM`, then `NOTIFICATIONS_EMAIL_FROM`).

- `app_setting` key `auth` → `{ registration, requireEmailVerification, magicLink,
  emailPassword, trustProviderEmails, personalWorkspaces, inviteTtlDays, inviteSearch,
  allowedEmailDomains }`.
- `app_secret` keys `auth.email`, `auth.google`, `auth.oidc` and `auth.scim` → the mail
  provider, Google, the OIDC provider and the instance's SCIM token, set in god mode.
- `app_secret` key `workspace.<id>.scim` → a workspace's SCIM token, set by the workspace owner.
  Those routes answer 403 unless a build turns per-workspace SCIM on.

Each secret is encrypted with `@repo/crypto` and has a `redacted` mirror. The settings routes
decrypt the value and build their DTO from it. `workspacesWithOwnScim` and the worker's telemetry
read the mirror, which needs no key. No route returns a stored secret. A new SCIM token is
returned once, by the request that generates it.

The mail provider is read by the api and the worker as well, so its shape and reader are in
`@repo/db` (`domains/instance-email.ts`). `src/instance.ts` holds the write side god mode drives.

"Invite only" means the address has a pending `team_invite` that has not expired
(`hasPendingInvite`). An invite expires `inviteTtlDays` after it was created (7 by default, 0 for
never, at most 3650). `inviteValidSince` computes the cutoff from the current setting on every
read, so a change applies to existing invites: a shorter lifetime expires them, and a longer one
or 0 brings expired ones back. An expired invite does not admit its address at the registration
gate and cannot be accepted. A new invite for the same address to the same team or project
replaces it. While the invite is live, a new one gets 409 `INVITE_ALREADY_PENDING`.

Invites are created and revoked inside a team or one of its projects, so `team_invite` is the
only invite table. God mode's invite settings are `inviteTtlDays` and `inviteSearch`.

`hooks.before` runs the registration gate on `/sign-up/email` (see "Registration gate"). While
verification is required it also holds back `/sign-in/email` and `/sign-in/username`: an existing
account with an unconfirmed address gets 403 `EMAIL_NOT_VERIFIED`, better-auth's own code for it.
The check runs before the password is compared, so a wrong password gets the same answer. It
also applies to accounts made before the setting was turned on. It covers password sign-in only:
a magic link confirms the address itself, and a Google or OIDC sign-in is not held back.
`authError` in `features/auth/services` maps that code, and the sign-in form then offers the
confirmation link again when an address was typed. A deactivated account and a disabled password
form are 403s too, so the form goes by the code.

The requirement needs a mail provider: the api refuses to turn it on without one, and
`setEmailSettings` clears it when the provider is removed. So the gate, the sign-up endpoint and
the public `/auth-config` read the setting alone. `magicLink` is refused and cleared the same way,
so the magic-link sender reads only the setting. `/auth-config` answers it as the setting and the
provider together.

`emailAndPassword.requireEmailVerification` is a getter over a module variable that
`hooks.before` refreshes from the setting on every password endpoint. better-auth reads the
option off the options object when `/sign-up/email` decides whether to open a session, so this is
what makes a required confirmation answer sign-up with `token: null` and no cookie instead of a
working session.

Authentication email (`src/mail.ts`) goes out through `@repo/mailer` and is best effort: with no
provider configured, or when the provider rejects the message, it logs and returns false, and the
endpoint answers as if the mail went out. Three kinds are sent: password reset, address
confirmation, and the magic link. Each goes out in the language the address saved, or the
browser's while it has none. God edits the texts and the layout at `/god/email-templates`. The
handler runs on the API origin, so the web app passes
`callbackURL`, `redirectTo` and, for a magic link, `errorCallbackURL` in `features/auth/services`.
The session confirmation on the Security page sends its own magic link from
`features/account/hooks/useConfirmSession.ts`.

With confirmation required, sign-up opens no session. A new address gets its user back. An address
that already has an account gets a made-up user, the same `token: null` and no mail, so the answer
does not reveal that the address is taken. The web sign-up shows a "confirm your email" screen for
both instead of entering the app, and the link opens the session (`autoSignInAfterVerification`).

## Username

The `username()` plugin adds `username` / `display_username` to the user table and the
`/sign-in/username` endpoint. Nobody is asked for a name: `databaseHooks.user.create.before` calls
`generateUsername`, which takes the local part of the address in lower case, removes everything
the plugin's validator rejects, cuts it to 27 characters and uses `user` when nothing is left. It
appends three random digits when that name is taken or is shorter than the 3-character minimum.
SCIM calls `generateUsername` too, since its direct insert passes no hook. An agent's bot user is
a direct insert that sets no username, so its username stays NULL.

The owner changes the name afterwards through `updateUser`. The plugin checks it against other
accounts on `/update-user` and `/sign-up/email`.

A username also addresses an agent in a mention, and a mention is resolved against the project's
members and its agents at once, so the two share one namespace. A member's name must differ from
every agent's on the instance, and an agent's from every member's. Agents of different teams may
share a handle (`ai_agent_team_username_uq`). Every path that sets a member's name checks it
against `ai_agent`: `hooks.before` refuses an `/update-user` that takes a name an agent already
uses, `databaseHooks.user.create.before` refuses a sign-up that carried one, and
`generateUsername` skips such a name. The check for the other direction is in the api, where an
agent is created or renamed.

The plugin's `/is-username-available` takes no session, so it is in `disabledPaths` and answers
404.

The sign-in screen has one field for both identifiers and picks the endpoint by whether what was
typed contains an "@". The verification gate in `hooks.before` runs before the plugin's own check
of `emailAndPassword.requireEmailVerification`.

## Generic OIDC

One OIDC/OAuth2 provider, discovered from the well-known document the operator points it at in god
mode (`app_secret` key `auth.oidc`). It is a social provider with the id `OIDC_PROVIDER_ID`
(`"oidc"`): sign-in is `/sign-in/social` with that provider, the callback is `/callback/oidc`, and
it reuses the `account` table, so it adds none.

A provider per workspace is not built on this one. A sign-in through it joins the account that
already holds the address, which is safe only because the provider is the instance owner's: a
workspace owner's provider could name any address. A per-workspace provider needs the workspace
to prove it owns the address's domain first, and is not part of this repository.

`providerId` is a constant because it is what the `account` rows store, and the rows hold the OIDC
`sub` (`accountSubject`). genericOAuth reads the discovery document once, when its plugin starts,
while this provider changes in god mode without a restart. So better-auth holds a proxy
(`oidcProvider`, registered by the `instanceOidc` plugin), and `refreshOidcProvider()` in
`hooks.before` builds the real provider with genericOAuth from the stored settings whenever they
change, on both halves of the round trip. When the provider is off or incomplete, the request is
refused with `OIDC_DISABLED`.

The redirect URI registered with the identity provider is `OIDC_REDIRECT_URI`,
`/api/auth/oauth2/callback/oidc`. The api passes that path on to better-auth's
`/api/auth/callback/oidc`, so the URI the identity providers hold stays valid.

Signing out leaves the session at the identity provider alone (`disableProviderLogout`). No screen
offers linking an OIDC identity to the signed-in account, so `hooks.before` refuses `/link-social`
for it. Only the standard `email_verified` claim says the address is verified: the OIDC
`mapProfileToUser` reads `true` and `"true"` as verified and anything else, `"false"` included, as
not.

## Turning password authentication off

`AuthSettings.emailPassword` (default `true`). When it is off, `hooks.before` refuses every path in
`PASSWORD_PATHS` with 403 `PASSWORD_AUTH_DISABLED`: the two sign-in endpoints, sign-up, password
reset, and both halves of the magic link, so a magic link issued before the setting changed cannot
be redeemed. Passkeys stay available: a passkey is only ever added to an account that already
exists. A confirmation link is not covered: `/send-verification-email` and `/verify-email` stay
open, and `autoSignInAfterVerification` opens a session for an unconfirmed account.

The setting is read per request. `emailAndPassword.enabled` cannot do this job: better-auth reads
it only on `/sign-up/email` and `/sign-in/email`, so `/sign-in/username`, password reset and the
magic link would stay open. `disabledPaths` is a static array.

The api refuses to turn it off while neither Google nor OIDC is usable, and refuses to make the
last usable provider unusable while it is off (`assertUsableSignInMethod`). Usable means the
provider is enabled with its credentials stored, plus a discovery URL for OIDC. Neither check
contacts the provider, so a wrong secret or a discovery URL that does not answer passes it, and
sign-in then fails.

## Passkey

`passkey({ rpID, rpName, origin })` adds WebAuthn. `rpID` is the hostname the credential binds to:
the host of the first `APP_URL` entry, or `PASSKEY_RP_ID` when it is set. `rpName` is
`PASSKEY_RP_NAME`, "It's a Plan" by default. The compose files and the Helm chart pass neither
variable to the api. `origin` is the whole `APP_URL` list, because the WebAuthn ceremony runs in
the frontend JS. The plugin adds the `passkey` table, which is mapped in the drizzle adapter's
`schema`. localhost is a secure context, so passkeys work over http in dev.

## Google sign-in

The credentials are stored in the database (`app_secret` key `auth.google`, encrypted), so god mode
can change them without a restart.

`socialProviders.google` is a factory that returns the module-level `googleOptions` object.
better-auth builds the provider list once per process, on first use, but the provider keeps that
object by reference and reads `clientId` / `clientSecret` off it on every call. So
`refreshGoogleOptions()` in `hooks.before` reloads it on `/sign-in/social`, `/link-social` and
`/callback/google`, and refuses the request when the credentials are missing or the toggle is off.

By default a provider address that has an account but no link to that identity signs into the
account only when the provider reports the address verified and the account's email is confirmed.
Otherwise the callback redirects with `account_not_linked`. The `trustProviderEmails` instance
setting drops both conditions: `resolveTrustedProviders` then names Google and the OIDC provider,
and `requireLocalEmailVerified` reads false.

## Registration gate

`assertRegistrationAllowed` runs in two places. `hooks.before` runs it on `/sign-up/email`, and
`databaseHooks.user.create.before` runs it for every account better-auth creates, which is what
applies closed/invite-only to a Google, OIDC or magic-link sign-up. SCIM accounts and agent bot
users are written with a direct insert and never reach it.

It refuses with 403 and `REGISTRATION_CLOSED` on a closed instance, `EMAIL_DOMAIN_NOT_ALLOWED` when
the address is not at one of `allowedEmailDomains` (an empty list admits any), and on an invite-only
instance `INVITE_ONLY` when the address has no pending invite and `INVITE_EXPIRED` when its only
invites have expired. The domain check runs first, so an invited address outside the list gets
`EMAIL_DOMAIN_NOT_ALLOWED`.

`INVITE_EXPIRED` reveals that the address was invited, so it is given only in the create hook,
where a provider or a magic link has proven the address. The hook treats any provider as proof and
does not read `email_verified`. The email form, open to anyone, gets `INVITE_ONLY`. The `APIError`s
carry a `code` because the provider callback and the magic link turn that into the `?error=` they
redirect with; without one the callback fails the request instead.
`registration-refusal-redirect.test.ts` pins that redirect, and `invite-forms.test.ts` pins
`INVITE_EXPIRED` on a magic link and `INVITE_ONLY` on the email form.

A domain in `allowedEmailDomains` matches the part of the address after the "@" exactly, so a
subdomain is listed on its own. The list applies to new accounts only. The api also refuses to
invite an address that has no account and is outside it, since it could not register. The gate asks
`registrationEmailAllowed`, which checks the list unless a build installs its own policy with
`setRegistrationEmailPolicy`.

## API keys

`apiKey({ enableSessionForAPIKeys: true })` makes an `x-api-key` header resolve to the owner's
session, so a key is a full-account credential. It therefore expires:
`keyExpiration.defaultExpiresIn` is 90 days and `maxExpiresIn` is a year, and the create dialog in
the web app offers 30/90/180/365 days. The plugin's option is documented as milliseconds but its
handler passes the value to `getDate(value, "sec")`, so `API_KEY_DEFAULT_EXPIRES_IN_SEC` is in
seconds. `maxExpiresIn` is in days, as the plugin reads it. The plugin treats a NULL `expires_at` as
no expiry. No migration sets one, so a personal key made before v1.0.0 works until its owner
deletes it.

The plugin resolves a key to the owner's session on every better-auth endpoint, and what that
session sets up there stays after the key is gone: a passkey enrolled with it signs in after the key
is deleted and the password reset, and a new key renews the expiry. So the first check in
`hooks.before` refuses any request that carries an `x-api-key` header: a key is for the planner API,
and the account is managed from a signed-in session. The connected-apps routes refuse a key too. The
check reads `ctx.request`, which a server-side `auth.api.*` call does not carry, so `issueKey` and
`getSessionFromHeaders` are unaffected. `hooks.before` also refuses an `/api-key/update` that carries
`expiresIn`: a longer life is a new key.

An agent's key carries no expiry. An agent replays its stored secret with nothing that would renew
it, and an external agent's operator rotates it through `regenerate-key`. The plugin applies the
default to every key it creates, so `issueKey` in `apps/api/src/modules/agents/core/service.ts`
clears `expires_at` on the row afterwards.

A key the plugin refuses with a 401 or 403 (expired, disabled, unknown or malformed) makes it throw
out of `auth.api.getSession` rather than return no session. `getSessionFromHeaders` turns that into
"no session", so an expired key is answered with a 401 instead of a 500. It rethrows any other
refusal, such as a rate-limited key's 429.

## MCP OAuth

`mcp()` from `@better-auth/mcp` serves OAuth 2.1 to MCP clients, with `jwt()` signing the access
tokens. A client that requests a token without the `resource` parameter gets an opaque token, which
`/mcp` refuses. `mcp()` adds the `oauth_client`, `oauth_resource`, `oauth_client_resource`,
`oauth_refresh_token`, `oauth_access_token`, `oauth_consent` and `oauth_client_assertion` tables,
and `jwt()` adds `jwks`. `mcp()` writes the MCP resource (`<API_URL>/mcp`) into `oauth_resource`
when the auth instance is created, on its first use, and leaves an existing row as it is. Any client
registers itself (RFC 7591), as ChatGPT and Claude do. The provider asks the person for consent the
first time a client asks for their account. Only `authorization_code` and `refresh_token` are
granted, so every token acts for a person. A registration that also lists a grant the server does
not issue, as Claude's connector does with `jwt-bearer`, is registered with the supported grants.
One that lists none of them is refused.

MCP clients register without `application_type`, and `mcp()` infers it
(`clientRegistrationDefaultApplicationType: 'infer'`): a client whose callback is http on
`localhost`, `127.0.0.1` or `[::1]` (Claude Code) or uses a custom scheme such as Cursor's
`cursor://` is registered as `native`, and any other as `web`, which takes an https callback only.
better-auth's own default, `web`, refuses the first two. A client that sends its `application_type`
keeps it.

The issuer is `API_URL` itself, path included, so the tokens and the discovery documents name the
URL a client reaches. The api serves the documents at the root of its origin
(`oauthAuthorizationServerMetadata`, `openIdConfiguration`, `oauthProtectedResourceMetadata`), and
the endpoints in them get the path back the way the links in auth emails do.

`verifyMcpAccessToken` checks a token against the instance's own keys in-process, with `iss` set to
`API_URL` and `aud` to `<API_URL>/mcp`, so changing `API_URL` ends every issued token. It refuses a
DPoP-bound token (`cnf` claim), because it takes no proof. Then it reads what a JWT cannot carry:

- The account must not be deactivated. This ends every MCP token of the account at once, whichever
  way it was deactivated. God mode also deletes the account's sessions and OAuth tokens. SCIM only
  sets `user.active`.
- A token issued in a session ends with that session, as better-auth's introspection has it.
  Signing out does not disconnect a client: deleting a session sets `session_id` on its refresh
  tokens to NULL, and a token refreshed after that carries no `sid`.
- The token's client must still be connected to the account, through the person's consent or a
  refresh token that is neither revoked nor expired. Disconnecting it on the account's Security page
  (`DELETE /account/connected-apps/:clientId`) deletes the consent, the refresh tokens, the
  `oauth_access_token` rows and any pending authorization code, which would otherwise connect the
  client again. This ends its tokens at once.

better-auth accepts a plain-HTTP MCP resource only on a loopback host, so any other instance without
HTTPS leaves `mcp()` and `jwt()` out and serves MCP to API keys only.

## OpenAPI reference

The `openAPI()` plugin (`better-auth/plugins`) documents the auth handler. It serves a Scalar UI at
`/api/auth/reference` and the raw schema at `/api/auth/open-api/generate-schema`. The schema is built
from every active plugin, so the passkey and apiKey endpoints appear without any manual description.
This is separate from the planner's own OpenAPI docs at `/docs` (the `@elysiajs/swagger` spec, which
does not see the catch-all auth handler).

God mode picks who may read both references and their raw documents (General → API docs). The api
answers 401 without a session and 403 to a user outside that audience. The web page loads `/docs/json`
with the session and hands it to Scalar.
