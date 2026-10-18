---
name: itsaplan-dev-origin-allowlist
description: Use when itsaplan sign-in fails with Failed to fetch.
category: backend
---

The api accepts browser requests only from origins listed in the root `.env` `APP_URL` (comma-separated). A web app opened on any other host, such as an Orca `*.orca.localhost` URL, fails at sign-in with "Failed to fetch".

- Add the exact origin the browser shows, with scheme and port, to `APP_URL` in the root `.env`, keeping `http://localhost:3001`.
- Restart the api and web dev servers so the value is read again.
- better-auth cookies are `SameSite=Lax`. The api on `localhost:3003` is a different site from `*.orca.localhost`, so the session may not persist. If sign-in loops back to the login page, use `http://localhost:3001` instead.
- Keep `.env.example` in sync when a new origin is documented.
