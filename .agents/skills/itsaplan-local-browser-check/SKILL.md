---
name: itsaplan-local-browser-check
description: Use when checking itsaplan UI in a local browser.
category: testing
---

# itsaplan local browser check

Open the web app at `http://localhost:3001`, not `127.0.0.1`. The API rejects sign-in and data calls from `127.0.0.1` with `INVALID_ORIGIN`, so the login form fails and data pages stay on "Loading…".

Steps:
1. Sign in through curl against the API, using the `localhost` origin. Save the better-auth session cookie to a temp file outside the repo.
2. In the browser, set that cookie on `localhost` and load the page.
3. Delete the temp file and stop any dev server you started.

Pitfalls:
- An unknown URL returns HTTP 200 with the not-found page, not 404. When verifying the 404 screen, check the rendered text, not the status code.
- A single-segment unknown path such as `/foo` is treated as a team address and redirects to team settings, not the 404 page. Use a deeper path such as `/a/b/c/d/e/f` to reach the 404 screen.
- The browser may already be signed in on `localhost:3001`. Check the rendered page before doing the curl sign-in.
- Dark mode can be checked by adding the `dark` class to `document.documentElement` through javascript, then taking a screenshot.
- Empty-state and other data-backed screens need a working session; without one they cannot be reached in the browser.
- The Docker stack publishes the API on the port `.env` names, which can be 3001, the web port. Bring it up with overrides: `API_PORT=3002 API_URL=http://localhost:3002 APP_URL=http://localhost:3001 docker compose up -d --build web`, then sign in against 3002.
- A curl gate against an auth-gated page is redirected to `/login`; check the rendered page in the browser for branded or 404 content.
