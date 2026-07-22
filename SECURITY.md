# Security Policy

## Supported versions

The project is under active development before its first stable release. Security fixes
are applied to `main`. There is no backporting to older tags yet.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Report it privately through GitHub Security Advisories:

<https://github.com/croffasia/itsaplan/security/advisories/new>

Include:

- what the problem is and what an attacker can do with it,
- the steps or a proof of concept to reproduce it,
- the version, image tag, or commit you tested,
- how the instance is deployed, if it matters.

You will get an acknowledgement within 72 hours and an assessment within 7 days. Once a
fix is released the advisory is published, and you are credited unless you ask not to be.

Please give a reasonable amount of time for a fix before disclosing publicly.

## Scope

In scope: the API, the web app, the worker, the Telegram bot, the shared packages, and
the deployment files in this repository.

Out of scope: vulnerabilities in third-party dependencies that have no exploitable path
in this project (report them upstream), findings that require an already compromised
host or database, missing hardening headers with no demonstrated impact, and denial of
service through raw request volume.

## Self-hosting notes

An instance is only as safe as its configuration:

- Generate `BETTER_AUTH_SECRET`, `APP_ENCRYPTION_KEY`, and `WORKER_INTERNAL_TOKEN` with
  `openssl rand -base64 32`. Never reuse the example values.
- `APP_ENCRYPTION_KEY` encrypts stored provider credentials at rest. Losing it makes
  those credentials undecryptable, changing it has the same effect.
- Serve the app over HTTPS. Cookies are marked `secure` in production.
- Keep the MinIO console and the Postgres port off the public network.
- `APP_URL` must be the real frontend origin, and nothing else (it is the auth trusted origin).
