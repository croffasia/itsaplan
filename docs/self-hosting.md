# Self-hosting

Requirements: Docker and a domain behind a TLS-terminating reverse proxy.

The TLS proxy is required. In production the session cookie is marked `Secure`, and
browsers do not keep a `Secure` cookie that arrives over plain HTTP: over `http://` the sign-in
request succeeds, but no session is kept and the app stays signed out. `http://localhost` is the
one exception in Chrome and Firefox; WebKit browsers such as Safari refuse it there too.

```bash
git clone https://github.com/croffasia/itsaplan.git
cd itsaplan
cp .env.example .env
# fill in the eight values below
docker compose up -d
```

The stack refuses to start while one of these is missing:

| Variable               | Value                                       |
| ---------------------- | ------------------------------------------- |
| `API_URL`              | public URL of the api                       |
| `APP_URL`              | public origin of the web app                |
| `POSTGRES_PASSWORD`    | `openssl rand -base64 32`                   |
| `BETTER_AUTH_SECRET`   | `openssl rand -base64 32`                   |
| `APP_ENCRYPTION_KEY`   | `openssl rand -base64 32`                   |
| `S3_ACCESS_KEY_ID`     | the RustFS root user, any name over 3 chars |
| `S3_SECRET_ACCESS_KEY` | `openssl rand -base64 32`                   |

On a machine with [Bun](https://bun.sh), the setup script generates them instead. Run
`bun install && bun run setup`, answer **Generate env**, and answer no when it offers to
write the files: it prints `.env` and `apps/web/.env` for you to copy onto the server.

That starts the whole stack: Postgres, RustFS, api, worker, bot, and web. The four services
run from the images published on each release. `VERSION` in `.env` pins one release instead
of the newest. The `migrate` service applies migrations before the api starts, and the first account you register
becomes the instance admin.

`.env.example` documents every variable, including the optional ones: legal document URLs,
passkey and cookie settings, telemetry opt-out, and worker tuning.

## Where the api lives

`API_URL` takes one of two forms:

- **Its own subdomain**, such as `https://api.example.com` beside `APP_URL=https://app.example.com`.
  The session cookie is set on the parent domain (`.example.com`), so every subdomain of it
  receives the cookie. `COOKIE_DOMAIN` narrows it when the two share a deeper parent. An
  `APP_URL` on the apex domain (`https://example.com`) has no parent to take, so this form
  needs `COOKIE_DOMAIN=.example.com`.
- **A path on the web's host**, such as `https://app.example.com/api` beside
  `APP_URL=https://app.example.com`. No second hostname or certificate is needed, and the
  session cookie stays on that one host: it has no `Domain`, and over HTTPS its name carries
  the `__Host-` prefix, which keeps another subdomain from setting one in its place.

With a path, the reverse proxy sends that path to the api and removes it on the way, so the
api receives `/projects`, `/api/auth/...` and `/mcp` as it does on its own subdomain:

```
https://app.example.com/api/*  ->  api:3000/*   (prefix removed)
https://app.example.com/*      ->  web:3001/*
```

For MCP clients that sign in with OAuth, the proxy also sends the discovery documents of the
host to the api: `/.well-known/oauth-authorization-server*`,
`/.well-known/oauth-protected-resource*` and `/.well-known/openid-configuration*`.

MCP clients sign in with OAuth only over HTTPS. On an `API_URL` that is plain HTTP and not
`localhost`, MCP takes personal API keys only.

An authorization the api cannot hand back to the client, because it does not know the client
or its redirect URI, ends on the web's sign-in page, which says what happened. A client that
keeps a registration the instance no longer has is told to remove the server and add it again.

The OAuth redirect URIs that god mode shows include the path. An api on a different
registrable domain than the web app (`api.other.com`) does not work: the session cookie
cannot be shared across sites.

## Mail

The instance sends password resets, address confirmations, sign-in links and invites through
the mail provider set in god mode under **Integrations → Email provider**: SMTP or Resend.

A Microsoft 365 mailbox refuses a password over SMTP once it has MFA. Set **Authentication**
to **Microsoft 365 (OAuth)** instead: the instance signs in as an Entra ID app registration
and sends as the mailbox over XOAUTH2. An empty server is filled with
`smtp.office365.com:587` and STARTTLS. On the Microsoft side:

1. Register an app in Entra ID, add a client secret, and grant it the Office 365 Exchange
   Online application permission `SMTP.SendAsApp`, with admin consent.
2. In Exchange Online PowerShell, register the app's service principal and give it access
   to the mailbox: `New-ServicePrincipal -AppId <client id> -ObjectId <enterprise app object id>`,
   then `Add-MailboxPermission -Identity <mailbox> -User <service principal id> -AccessRights FullAccess`.
3. Turn on SMTP AUTH for that mailbox (`Set-CASMailbox <mailbox> -SmtpClientAuthenticationDisabled $false`).

Then paste the tenant ID, the client ID and the secret into the page and send a test. A
refused token is reported as rejected credentials and is not retried.

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
decides whether it may: `open` creates it, `invite only` needs a pending invite that has
not expired, `closed` refuses it. Invites expire after the days set under **Authentication**
(7 by default, 0 for never); an expired one is renewed from the member list under a new
link. A refused sign-in returns to the sign-in page, which says why: the instance is
closed, it needs an invite, or the invite expired. On a closed instance, provision people
with SCIM.

A sign-in whose address already has an account joins that account instead of creating a
second one. That needs the provider to report the address as verified and the account to
have confirmed its own, so it is refused when the OIDC client leaves `email_verified` off
the token, or when the instance has no mail provider and so no confirmed accounts.
**Authentication → Trust addresses from sign-in providers** drops both conditions. Turn it
on only where you control who can register at the provider: anyone who registers an address
there takes over the account that holds it here.

### SAML 2.0

Any SAML 2.0 identity provider works: Okta, Entra ID, ADFS, Google Workspace, Keycloak,
Authentik. It is set on the same page, under **SAML 2.0**.

1. Give the provider the values the page shows: the **ACS URL**
   (`<API_URL>/api/auth/sso/saml2/sp/acs/saml`), where it posts the signed response, and the
   **SP entity ID**. A provider that reads SP metadata can take the **SP metadata URL**
   (`<API_URL>/api/auth/sso/saml2/sp/metadata?providerId=saml`) instead; it answers once IdP
   metadata is stored.
2. Paste the provider's metadata URL, or its metadata XML. A URL is fetched once, when you
   save, and the document is stored; save again after the provider rotates its certificate.
   The document must name the provider's entity ID, an HTTP-Redirect or HTTP-POST sign-on
   URL, and a signing certificate.
3. The address is read from the `email` attribute, then from the NameID, and the name from
   `givenName` and `surname`, then `displayName`. Set **Email attribute** and **Name
   attribute** when the provider uses other names (Entra ID sends
   `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress`).
4. Name the sign-in button and turn the provider on.

Assertions must be signed. The registration mode applies as it does to OIDC. A SAML provider
reports no verified flag for the address, so a sign-in joins an existing account only while
**Trust addresses from sign-in providers** is on.

Once a provider works, you can turn off **Authentication → Email and password**, or **Single
sign-on only** under SAML 2.0, which is the same switch. The sign-in
and sign-up forms, password reset and sign-in links are then hidden and refused, and the
provider is the only way in. Passkeys keep working, because a passkey can only be added to an
account that already exists. The switch stays disabled until a provider is configured, so an
instance cannot be left with no way in.

## Provisioning with SCIM

An identity provider can create, deactivate and delete the accounts of the instance over
SCIM 2.0, and grant project access through its groups. Provisioning is set up in god mode by
the instance owner.

1. In god mode, open **SCIM**, generate a token and copy it — it is shown once — then turn
   provisioning on.
2. Point your provider's SCIM application at the endpoint the page shows
   (`<API_URL>/scim/v2`), authenticating with `Authorization: Bearer <token>`.
3. Push users, and groups if you use them.

The provider sees every account of the instance except those of AI agents. A create for an
address that already has an account links that account instead of making a second one, and a
name or address the provider sends is written to the account. While provisioning is on, the
provider decides which accounts are active, and god mode cannot deactivate or reactivate one.

Deactivating someone at the provider (`active: false`) keeps their teams and projects, but the
account cannot sign in, and its sessions and API keys are refused until it is reactivated.
Reactivating gives them the projects their groups grant. Deleting someone deletes the
account. The delete is refused while they are the only owner of a project outside their own
workspaces: deactivate them instead, or hand the project to another owner first. The instance
owner is outside SCIM's reach, and a repeated create for an address the provider already
linked answers "already exists" rather than overwriting the link.

A pushed group grants nothing until you say what it is for: on the same page, open a group
and add the projects its members should join, and the role they join on. A project belongs
to a team, so joining one also makes the person a member of that team, on the plain member
rank; the roles you can pick from are the team's. Removing a project from that list takes
away the memberships the group gave it, and once the group grants nothing else in that team,
the team membership goes with them. A membership someone got through an invite is never
touched by a sync, in either direction, and one the sync created cannot be edited from the
project's members page, nor ended from the team's — it changes at the identity provider.
What the person ranks as in the team is still the team's own to set.

A group also appears here without any explicit push, in two cases: a SCIM user whose
payload embeds a `groups` attribute instead of being assigned through a separate group
push, and anyone who signs in through OIDC while their identity provider puts a `groups`
claim on the token — set that up as a claim mapping on the OIDC client if the provider
supports one. Either way, map the group the same way once it shows up.

## Storing files in SharePoint / OneDrive

By default every stored file (issue, chat, document and initiative attachments, avatars,
skill files, import uploads) goes to the S3-compatible store. Set `STORAGE_DRIVER=sharepoint`
to keep them in a SharePoint document library or OneDrive drive through Microsoft Graph
instead. The database, the object keys and the app behave the same either way; with
`sharepoint` the `S3_*` variables are not read and the bundled RustFS is not needed.

**1. Register an app in Entra ID.** In the Azure portal, open Microsoft Entra ID, App
registrations, New registration (single tenant). Note the **Directory (tenant) ID** and
**Application (client) ID**. Under Certificates & secrets, create a client secret and copy its
value.

**2. Give it permission.** Under API permissions, add Microsoft Graph, **Application**
permissions, and grant admin consent. Use one of:

- `Sites.Selected` (recommended, least privilege). The app can reach only the sites you grant
  it in step 3.
- `Sites.ReadWrite.All` (simpler). The app can read and write every site in the tenant. Skip
  step 3.

**3. Grant the app one site (`Sites.Selected` only).** Find the site id (step 4), then, as an
admin with `Sites.FullControl.All` (a separate admin app or Graph Explorer):

```
POST https://graph.microsoft.com/v1.0/sites/{site-id}/permissions
Content-Type: application/json

{
  "roles": ["write"],
  "grantedToIdentities": [
    { "application": { "id": "<client id>", "displayName": "itsaplan" } }
  ]
}
```

or with PnP PowerShell: `Grant-PnPAzureADAppSitePermission -AppId <client id> -DisplayName itsaplan -Site https://contoso.sharepoint.com/sites/itsaplan -Permissions Write`.

**4. Find the site id.**

```
GET https://graph.microsoft.com/v1.0/sites/{hostname}:/sites/{path}
```

for example `.../sites/contoso.sharepoint.com:/sites/itsaplan`. The `id` in the response
(`contoso.sharepoint.com,<siteCollectionId>,<webId>`) is `SHAREPOINT_SITE_ID`. The app uses the
site's default document library. To use another library or a OneDrive drive, set
`SHAREPOINT_DRIVE_ID` instead (`GET /sites/{site-id}/drives` lists them).

**5. Set the variables** on the api and the worker (the compose files and the Helm chart pass
them through):

| Variable                  | Value                                                       |
| ------------------------- | ----------------------------------------------------------- |
| `STORAGE_DRIVER`          | `sharepoint` (unset or `s3` keeps S3)                       |
| `SHAREPOINT_TENANT_ID`    | Directory (tenant) ID                                       |
| `SHAREPOINT_CLIENT_ID`    | Application (client) ID                                     |
| `SHAREPOINT_CLIENT_SECRET`| Client secret value                                         |
| `SHAREPOINT_SITE_ID`      | Site id (or `SHAREPOINT_DRIVE_ID`)                          |
| `SHAREPOINT_ROOT_FOLDER`  | Folder inside the drive for every file. Default `itsaplan`  |

A missing variable makes the first upload or download fail with a message naming it.

How it behaves:

- Files live under `<root folder>/<object key>`, for example
  `itsaplan/projects/3/attachments/12/<uuid>-report.pdf`. Do not rename or move them in
  SharePoint: the app finds them by that path.
- Uploads up to 4 MB are one request. Larger files use a Graph upload session in 10 MiB chunks
  (a multiple of 320 KiB, as Graph requires).
- Graph stores no arbitrary content type. Attachments are served with the content type kept in
  the database. Where the app has only the file (avatars), the type comes from the file
  extension, or from the first bytes for images and PDFs.
- Graph throttling (429, 503, 504) is retried up to 5 times, honouring `Retry-After`.
- SharePoint limits apply: file names cannot contain `" * : < > ? \ |`, and a library has its
  own storage quota and versioning (every overwrite makes a version).

**Existing files are not migrated.** After switching, objects already in S3 are missing until
you copy them. The one-off script reads every object key from the database (issue, chat,
initiative and document attachments, skill files, avatars) and copies it from S3 to SharePoint
under the same key. It never deletes from S3 and is safe to run again:

```bash
# .env still holds the S3_* values and now the SHAREPOINT_* ones
bun --env-file=.env scripts/storage-copy-s3-to-sharepoint.ts --dry-run   # list the keys
bun --env-file=.env scripts/storage-copy-s3-to-sharepoint.ts
```

Run it before or just after switching the api and worker, from a checkout of the repository
with dependencies installed. Keys missing in S3 are reported and skipped.

## Updating

```bash
git pull
docker compose pull
docker compose up -d
```

`git pull` updates the compose file. The services come from the registry. Changing `API_URL`
or `APP_URL` afterwards only needs `docker compose up -d`.

The one-shot `migrate` service applies the migrations on every `docker compose up -d`, and
api, worker and bot start only after it succeeds, so an upgrade needs no database step.
Before it applies anything it dumps the database into the `db-backups` volume (`/backups`
in the `migrate` container) and fails if that dump fails — a release whose migrations
rewrite data is not applied without something to go back to. Dumps are deleted after 30
days, on the first startup past that; `BACKUP_RETENTION_DAYS` changes the window and
`SKIP_PRE_MIGRATION_BACKUP=1` upgrades without one, for an operator who backs up by
other means. After the upgrade the app shows the instance owner where the dump is and
what the migrations changed.

Attachments are stored in RustFS. An instance set up with MinIO switches to it on the next
`docker compose up -d`: the `minio` service keeps its name and its `minio-data` volume, and
RustFS reads the files MinIO wrote in place, with the same credentials. Nothing is copied,
and the files stay readable by MinIO. The upgrade touches no attachment data, but a copy of
the volume before it costs one command:

```bash
docker run --rm -v itsaplan_minio-data:/data -v "$PWD":/out alpine tar czf /out/minio-data.tgz -C /data .
```

If you call the API from your own scripts or from an MCP client, read the
[release notes](https://github.com/croffasia/itsaplan/releases) for the paths a release removed.

## Building from source instead

```bash
docker compose up -d --build
```

That builds every service from this checkout and runs those images. Nothing else changes, and
the same command picks up local edits.

For a Coolify instance, see [coolify.md](coolify.md). For Kubernetes, see [helm.md](helm.md).
For a hosted deploy without a server of your own, see [railway.md](railway.md).
