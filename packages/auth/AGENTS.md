# @repo/auth

The **server-side** better-auth instance. Consumed by `apps/api`. See root `AGENTS.md`.

- `src/index.ts` — `export const auth = betterAuth({...})` with the Drizzle adapter
  (`provider: "pg"`) over `@repo/db`. Email+password enabled (no email confirmation:
  `requireEmailVerification: false`, `autoSignIn: true`), plus the WebAuthn passkey
  plugin (`@better-auth/passkey`).
- Exports `auth`, `USER_ROLES` / `UserRole`, `generateUsername` (the SCIM module derives a
  handle with the same rule), plus `Auth` / `Session` types.

## User role

The user table has a `role` column (`"god"` | `"user"`), declared as a better-auth
`additionalField` with `input: false` (not client-settable). A `databaseHooks.user.create.before`
hook sets it: the first user to register gets `"god"`, everyone after gets `"user"`.

## Instance settings (`src/instance.ts`)

Registration mode, which sign-in methods are offered, the mail provider, the OAuth
credentials and the SCIM token are stored in the database, not in env, so god mode can
change them without a restart. Read them
through this module — never inline a query on `app_setting` / `app_secret` elsewhere.

- `app_setting` key `auth` → `{ registration, requireEmailVerification, magicLink,
  emailPassword }`.
- `app_secret` keys `auth.email`, `auth.google`, `auth.oidc` and `auth.scim` → the mail
  provider, the two OAuth providers and the SCIM token, encrypted with `@repo/crypto`,
  each with a `redacted` mirror for the settings UI. Secrets never leave the server.

"Invite only" means the address has a pending `project_invite` (`hasPendingInvite`).
Invites are created and revoked inside a project, so there is no instance-level invite
table and god mode has no invite section — do not add one.

`hooks.before` gates `/sign-up/email` (closed → 403, invite → no pending invite for
that address → 403) and holds back `/sign-in/email` for an unconfirmed address while
verification is required **and** a mail provider is configured — without one the
address can never be confirmed, so the gate lifts instead of locking the account out.
That is the same condition the public `/auth-config` reports, so the sign-in screen
and the gate never disagree. Because both read the settings per request,
`emailAndPassword.requireEmailVerification` stays `false` in the static config — do
not flip it to `true`.

Authentication email (`src/mail.ts`) goes out through `@repo/mailer` and is best
effort: with no provider configured it logs and returns false rather than failing the
request. Three kinds are sent: password reset, address confirmation, and the magic
link. Every link must carry a `callbackURL`/`redirectTo` on the **web** origin — the
handler runs on the API origin, so a link built without one lands the reader on the
API, which renders nothing. The web app passes them in `features/auth/services`.

`autoSignIn` opens a session even when confirmation is required (the static config
cannot depend on the setting), so the web sign-up drops that session and shows a
"confirm your email" screen instead.

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
what was typed contains an "@". `/sign-in/username` checks only the static
`emailAndPassword.requireEmailVerification`, which is `false` here, so the instance
verification gate in `hooks.before` covers that path as well as `/sign-in/email`.

## Generic OIDC

`genericOAuth({ config: [oidcOptions] })` adds one OIDC/OAuth2 provider, discovered from
the well-known document the operator points it at (`app_secret` key `auth.oidc`). It adds
`/sign-in/oauth2` and `/oauth2/callback/:providerId`, and reuses the `account` table, so it
adds none of its own.

`providerId` is the constant `OIDC_PROVIDER_ID` (`"oidc"`): it is what the `account` rows
store, and better-auth materialises the provider list once at startup, so the config array
can neither grow nor be re-keyed afterwards. That is also why there is exactly one
provider. `oidcOptions` is refreshed per request by `refreshOidcOptions()` in
`hooks.before` — the same by-reference rule as `googleOptions`: assign its fields, never
replace the object.

`/oauth2/link` is in `disabledPaths`. No screen offers linking an OIDC identity to the
signed-in account, and better-auth already attaches a sign-in to a matching confirmed
address on its own.

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

## Deactivation and SCIM

Two more `additionalFields` on the user table, both written only over SCIM and both
nullable, so every check is `active !== false` rather than `!active`:

- `active` — the deprovisioning flag. `databaseHooks.session.create.before` refuses to open
  a session for an inactive account, which covers every sign-in method at once; `apps/api`
  refuses the sessions and API keys that were already open.
- `scimExternalId` — the identity provider's own id, used to correlate an account it did
  not choose the id for.

`getScimSettings` / `rotateScimToken` / `verifyScimToken` hold the bearer token the SCIM
endpoints in `apps/api` authenticate with. The token is returned in the clear exactly once,
when it is generated; only its prefix is kept in the redacted mirror.

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
applies closed/invite-only to a Google sign-up. Its `APIError`s carry a `code` because the
social callback turns that into the `?error=` it redirects with; without one the callback
fails the request instead. Agent bot users are written with a direct insert and never
reach the hook.

## OpenAPI reference

The `openAPI()` plugin (`better-auth/plugins`) documents the auth handler. It serves a
Scalar UI at `/api/auth/reference` and the raw schema at
`/api/auth/open-api/generate-schema`. The schema is built from every active plugin, so
the passkey and apiKey endpoints appear without any manual description. This is separate
from the planner's own OpenAPI docs at `/docs` (the `@elysiajs/swagger` spec, which does
not see the catch-all auth handler). Docs-only: it adds no table, so `auth:generate` is
not required for it.

## Rules

- This package is **server-only** — never import a client SDK (`better-auth/react`) here;
  the web app owns its own `auth-client.ts`.
- Changing the config (plugins, fields) can change the DB tables → run `bun run auth:generate`
  (writes `packages/db/src/schema/auth.ts`), then `db:generate` + `db:migrate`.
- Config is env-driven: `API_URL` (backend origin, used as better-auth `baseURL`),
  `BETTER_AUTH_SECRET`, `APP_URL` (frontend origin(s), comma-separated). `API_URL` and
  `APP_URL` are mandatory and have no default — importing this module throws
  when either is missing. Do not add a localhost fallback: cookies, the passkey
  relying party, the cookie domain and every link in an authentication email are
  derived from them, so a wrong value fails silently at runtime instead of at startup.
  The parsed `trustedOrigins` list (from `APP_URL`) is exported so the api's CORS uses
  the same value.
- **Cross-domain prod:** default cookies are `sameSite: "lax"`. If frontend/backend run on
  different domains, switch to `sameSite: "none"` + `secure: true`; for subdomains use
  `advanced.crossSubDomainCookies`.
