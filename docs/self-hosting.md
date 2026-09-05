# Self-hosting

Requirements: Docker and a domain behind a TLS-terminating reverse proxy.

```bash
git clone https://github.com/croffasia/itsaplan.git
cd itsaplan
cp .env.example .env
# fill in the eight values below
docker compose up -d
```

The stack refuses to start while one of these is missing:

| Variable                | Value                                      |
| ----------------------- | ------------------------------------------ |
| `API_URL`               | public origin of the api                   |
| `APP_URL`               | public origin of the web app               |
| `POSTGRES_PASSWORD`     | `openssl rand -base64 32`                  |
| `BETTER_AUTH_SECRET`    | `openssl rand -base64 32`                  |
| `APP_ENCRYPTION_KEY`    | `openssl rand -base64 32`                  |
| `WORKER_INTERNAL_TOKEN` | `openssl rand -base64 32`                  |
| `S3_ACCESS_KEY_ID`      | the MinIO root user, any name over 3 chars |
| `S3_SECRET_ACCESS_KEY`  | `openssl rand -base64 32`                  |

On a machine with [Bun](https://bun.sh), the setup script generates them instead. Run
`bun install && bun run setup`, answer **Generate env**, and answer no when it offers to
write the files: it prints `.env` and `apps/web/.env` for you to copy onto the server.

That starts the whole stack: Postgres, MinIO, api, worker, bot, and web. The four services
run from the images published on each release. `VERSION` in `.env` pins one release instead
of the newest. The api applies migrations when it starts, and the first account you register
becomes the instance admin.

`.env.example` documents every variable, including the optional ones: legal document URLs,
passkey and cookie settings, telemetry opt-out, and worker tuning.

## Single sign-on

Any provider with an OpenID Connect discovery document works: Keycloak, Authentik, KanIDM,
GitLab, Forgejo, Okta, Entra. The credentials go into the database, not into `.env`, so
nothing here needs a restart.

1. In god mode, open **Integrations → Auth provider** and copy the redirect URI it shows
   (`<API_URL>/api/auth/oauth2/callback/oidc`).
2. Create a confidential client at your provider with that redirect URI.
3. Paste the discovery URL (`.../.well-known/openid-configuration`), the client ID and the
   client secret back into the page. Name the sign-in button and turn the provider on.

The first sign-in creates the account, and the registration mode under **Authentication**
decides whether it may: `open` creates it, `invite only` needs a pending project invite,
`closed` refuses it. On a closed instance, provision people with SCIM.

Once a provider works, you can turn off **Authentication → Email and password**. The sign-in
and sign-up forms, password reset and sign-in links are then hidden and refused, and the
provider is the only way in. Passkeys keep working, because a passkey can only be added to an
account that already exists. The switch stays disabled until a provider is configured, so an
instance cannot be left with no way in.

## Provisioning with SCIM

An identity provider can create, update and deactivate accounts over SCIM 2.0, and grant
project access through its groups.

1. In god mode, open **Integrations → SCIM**, generate a token and copy it — it is shown
   once — then turn provisioning on.
2. Point your provider's SCIM application at the endpoint the page shows
   (`<API_URL>/scim/v2`), authenticating with `Authorization: Bearer <token>`.
3. Push users, and groups if you use them.

Deactivating someone at the provider (`active: false`) ends their sessions and refuses their
API keys. Reactivating restores both, with their projects intact.

The instance owner's account is outside SCIM's reach: a provisioning run cannot change or
deactivate it. A repeated create for an address SCIM already provisioned answers "already
exists" instead of overwriting the link back to the provider.

A pushed group grants nothing until you map it. On the same page, open the group and add the
projects its members join, and the role they join on. Remove a project from that list, and
the memberships the group gave it go away.

A sync never touches a membership someone got through an invite. A membership the sync
created cannot be edited from the project's members page — it changes at the identity
provider.

A group also appears here without an explicit push in two cases:

- a SCIM user whose payload embeds a `groups` attribute, instead of a separate group push,
- anyone who signs in through OIDC while their provider puts a `groups` claim on the token.
  Set that up as a claim mapping on the OIDC client.

Map such a group the same way once it appears.

## Updating

```bash
git pull
docker compose pull
docker compose up -d
```

`git pull` updates the compose file. The services come from the registry. Changing `API_URL`
or `APP_URL` afterwards only needs `docker compose up -d`.

## Building from source instead

```bash
docker compose up -d --build
```

That builds every service from this checkout and runs those images. Nothing else changes, and
the same command picks up local edits.

For a Coolify instance, see [coolify.md](coolify.md). For Kubernetes, see [helm.md](helm.md).
For a hosted deploy without a server of your own, see [railway.md](railway.md).
