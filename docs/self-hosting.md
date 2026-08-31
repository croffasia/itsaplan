# Self-hosting

Requirements: Docker and a domain behind a TLS-terminating reverse proxy.

```bash
git clone https://github.com/croffasia/itsaplan.git
cd itsaplan
cp .env.example .env
# Set the public origins: API_URL, APP_URL
# Generate each secret with `openssl rand -base64 32`:
#   POSTGRES_PASSWORD, BETTER_AUTH_SECRET, APP_ENCRYPTION_KEY,
#   WORKER_INTERNAL_TOKEN, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY

docker compose up -d
```

One command brings up the whole stack: Postgres, MinIO, api, worker, bot, and web. The four
services run from the images published on each release; `VERSION` in `.env` pins one instead
of the newest. The API applies migrations on startup, and the first account registered
becomes the instance admin.

`.env.example` documents every variable, including the optional ones: legal document URLs,
passkey and cookie settings, telemetry opt-out, and worker tuning.

## Single sign-on

Any provider that publishes an OpenID Connect discovery document works: Keycloak,
Authentik, KanIDM, GitLab, Forgejo, Okta, Entra. The credentials are stored in the
database, not in env, so nothing here needs a restart.

1. In god mode, open **Integrations → Auth provider** and copy the redirect URI it shows
   (`<API_URL>/api/auth/oauth2/callback/oidc`).
2. Create a confidential client at your provider with that redirect URI.
3. Paste the discovery URL (`.../.well-known/openid-configuration`), the client ID and the
   client secret back into the page, name the sign-in button, and turn the provider on.

A first sign-in creates the account, subject to the registration mode under
**Authentication**: `open` creates it, `invite only` needs a pending project invite, and
`closed` refuses it — use SCIM below to provision people on a closed instance.

Once a provider works, **Authentication → Email and password** can be turned off. That
hides and refuses the sign-in and sign-up forms, password reset and sign-in links; the
provider becomes the only way in. Passkeys keep working, since one can only be added to an
account that already exists. The switch stays disabled until a provider is configured, so
an instance cannot be left with no way in.

## Provisioning with SCIM

An identity provider can create, update and deactivate accounts over SCIM 2.0, and grant
project access through its groups.

1. In god mode, open **Integrations → SCIM**, generate a token and copy it — it is shown
   once — then turn provisioning on.
2. Point your provider's SCIM application at the endpoint the page shows
   (`<API_URL>/scim/v2`), authenticating with `Authorization: Bearer <token>`.
3. Push users, and groups if you use them.

Deactivating someone at the provider (`active: false`) ends their sessions and refuses
their API keys; reactivating restores them with their projects intact. The instance owner's
own account is outside SCIM's reach — a provisioning run can neither change nor deactivate
it, and a repeated create for an address it already provisioned answers "already exists"
rather than overwriting the link back to the provider.

A pushed group grants nothing until you say what it is for: on the same page, open a group
and add the projects its members should join, and the role they join on. Removing a project
from that list takes away the memberships the group gave it. A membership someone got
through an invite is never touched by a sync, and one the sync created cannot be edited from
the project's members page — it changes at the identity provider.

A group also appears here without any explicit push, in two cases: a SCIM user whose
payload embeds a `groups` attribute instead of being assigned through a separate group
push, and anyone who signs in through OIDC while their identity provider puts a `groups`
claim on the token — set that up as a claim mapping on the OIDC client if the provider
supports one. Either way, map the group the same way once it shows up.

## Updating

```bash
git pull
docker compose pull
docker compose up -d
```

`git pull` is for the compose file itself; the services come from the registry. Changing
`API_URL` or `APP_URL` afterwards only needs `docker compose up -d`.

## Building from source instead

```bash
docker compose up -d --build
```

Builds every service from this checkout and runs those images. Nothing else changes, and
the same command picks up local edits.

For a Coolify instance, see [coolify.md](coolify.md). For Kubernetes, see
[helm.md](helm.md). For a hosted deploy without a server of your own, see
[railway.md](railway.md).
