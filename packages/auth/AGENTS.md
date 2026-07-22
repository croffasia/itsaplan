# @repo/auth

The **server-side** better-auth instance. Consumed by `apps/api`. See root `AGENTS.md`.

- `src/index.ts` — `export const auth = betterAuth({...})` with the Drizzle adapter
  (`provider: "pg"`) over `@repo/db`. Email+password enabled (no email confirmation:
  `requireEmailVerification: false`, `autoSignIn: true`), plus the WebAuthn passkey
  plugin (`@better-auth/passkey`).
- Exports `auth`, `USER_ROLES` / `UserRole`, plus `Auth` / `Session` types.

## User role

The user table has a `role` column (`"god"` | `"user"`), declared as a better-auth
`additionalField` with `input: false` (not client-settable). A `databaseHooks.user.create.before`
hook sets it: the first user to register gets `"god"`, everyone after gets `"user"`.

## Instance settings (`src/instance.ts`)

Registration mode, the email-dependent auth options, and the mail provider are stored
in the database, not in env, so god mode can change them without a restart. Read them
through this module — never inline a query on `app_setting` / `app_secret` elsewhere.

- `app_setting` key `auth` → `{ registration, requireEmailVerification, magicLink }`.
- `app_secret` key `auth.email` → the mail provider, encrypted with `@repo/crypto`,
  with a `redacted` mirror for the settings UI. Secrets never leave the server.

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
