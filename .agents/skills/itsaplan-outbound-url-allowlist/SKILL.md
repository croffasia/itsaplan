---
name: itsaplan-outbound-url-allowlist
description: Use when a saved base URL needs an SSRF check.
category: security
---

# Outbound URL checks in itsaplan

Validate every server-side URL a user saves with `assertPublicHttpUrl` from `@repo/net` on create and on update, using the merged credential, not only the fields in the request body.

- Private, loopback, link-local and metadata addresses are refused with a 400 that names the reason.
- A self-hosted local model is allowed only when its `host:port` is listed in an allow-list env var (for example `LLM_ALLOWED_PRIVATE_HOSTS`). Match host and port together, case-insensitively.
- Add the env var to `.env.example` and to the api service in all three deploy compose files, and document it in the feature's doc page. Do not leave `.env.example` for later.
- Cover in tests: a refused metadata address, a listed local host accepted, an unlisted local port refused, and a PATCH to a private address refused.
