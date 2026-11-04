# @repo/auth

The server-side better-auth instance, consumed by `apps/api`. `docs/dev/auth.md` explains how each
sign-in method, setting and token works. Read it before you change one.

## Rules

- This package is server-only. Never import a client SDK (`better-auth/react`) here.
- A change to plugins or fields can change the DB tables. Run `bun run auth:generate`, then
  `db:generate` and `db:migrate`. `src/schema/auth.ts` in `@repo/db` is generated.
- `API_URL` and `APP_URL` are mandatory. Do not add a localhost fallback: cookies, the passkey
  relying party and every link in an auth email come from them, so a wrong value fails silently.
- Instance settings are in the database so they change without a restart. Read them through
  `src/instance.ts`. Never inline a query on `app_setting` or `app_secret`. Secrets never leave the
  server.
- Do not replace the `emailAndPassword.requireEmailVerification` getter with a static value: `true`
  locks every account out, `false` hands an unconfirmed sign-up a session.
- Do not reassign `googleOptions`. Assign its fields: the provider keeps the object by reference.
- Keep `accountLinking.trustedProviders` as `resolveTrustedProviders`. It trusts a provider only
  while `trustProviderEmails` is on. A static list would let whoever registered an address first
  receive its real owner.
- Password sign-in off is read per request, so it cannot be `emailAndPassword.enabled: false` or a
  `disabledPaths` entry.
- Use `getSessionFromHeaders`, not `auth.api.getSession`, where a request may carry a key. An
  expired key throws out of `getSession` and would answer 500.
- A key is for the planner API. `hooks.before` refuses `x-api-key` on every auth endpoint. Only an
  agent's key has no expiry (`issueKey`).
- Every auth email link carries a `callbackURL` or `redirectTo` on the **web** origin. Without one
  it lands on the API, which renders nothing.
- A username shares one namespace with agents. Every path that sets a member's name checks it
  against `ai_agent`.
- `/is-username-available` stays in `disabledPaths`: it would tell a stranger which addresses are
  registered.
- Invites belong to a team. There is no instance-level invite table. Do not add a god mode invite
  section.
- An OIDC provider per workspace is not built on the instance provider: a workspace owner's
  provider could name any address.
- **`API_URL` with a path:** better-auth's `baseURL` gets only the origin. Every public URL built
  from it gets the path back through `apiPublicUrl` / `withPublicOrigin`.
- **Cookies:** `sameSite: "lax"`. If frontend and backend run on different domains, switch to
  `sameSite: "none"` + `secure: true`.
