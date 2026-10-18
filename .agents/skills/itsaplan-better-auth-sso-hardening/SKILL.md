---
name: itsaplan-better-auth-sso-hardening
description: Use when changing better-auth SSO or SAML config.
category: security
---

# better-auth SSO hardening in itsaplan

- An SSO endpoint the product does not use is listed in `disabledPaths` in `packages/auth/src/index.ts`. The SSO domain-verification endpoints (`/sso/request-domain-verification`, `/sso/verify-domain`) are disabled this way and must return 404.
- The SAML provider list is cleared and refilled with no `await` between the two steps, so a concurrent request cannot read an empty list. Keep a comment on that rule.
- A SAML change needs negative tests against the ACS URL (`/api/auth/sso/saml2/sp/acs/...`): an unsigned response and a response with a forged signature must each redirect with `error=saml_error` and set no session cookie. Build fixtures in `god/__tests__/fixtures/saml.ts`.
- If a test asserts a redirect URI built from `API_URL`, check the value in `.env.test` first (see `itsaplan-repo-verification-runs`).
