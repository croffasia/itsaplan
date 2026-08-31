# Deploy on Kubernetes (Helm)

The Helm chart in `charts/itsaplan/` deploys the full stack on any Kubernetes 1.24+ cluster. It runs the published
images from GHCR, with built-in PostgreSQL and MinIO that can each be swapped for an external service.

## Prerequisites

- Kubernetes 1.24+
- Helm 3.10+

## Install

Create a values file for the deployment:

```yaml
api:
  env:
    API_URL: "https://api.example.com"
    APP_URL: "https://app.example.com"
    S3_BUCKET: "planner-attachments"

secrets:
  postgresPassword: ""    # openssl rand -base64 32
  betterAuthSecret: ""    # openssl rand -base64 32
  appEncryptionKey: ""    # openssl rand -base64 32
  workerInternalToken: "" # openssl rand -base64 32
  s3AccessKeyId: "minioadmin"
  s3SecretAccessKey: "minioadmin"
```

Install the chart:

```bash
helm install itsaplan charts/itsaplan -f values.yaml
```

The API applies database migrations on startup. The first account registered becomes the instance admin.

## What gets deployed

| Resource          | Kind                        | Condition                             |
|-------------------|-----------------------------|---------------------------------------|
| API (Elysia)      | Deployment + Service        | always                                |
| Web (Next.js)     | Deployment + Service        | always                                |
| Worker            | Deployment                  | always                                |
| Bot (Telegram)    | Deployment                  | `bot.enabled` (default `true`)        |
| PostgreSQL        | StatefulSet + Service + PVC | `postgresql.enabled` (default `true`) |
| MinIO             | Deployment + Service + PVC  | `minio.enabled` (default `true`)      |
| MinIO bucket init | Job (Helm hook)             | `minio.enabled`                       |

Ingress, TLS certificates, and a ServiceAccount are available but disabled by default.

## Ingress

The API cannot serve behind a path prefix (better-auth mounts at `/api/auth/*` and treats a path inside `API_URL` as a
replacement for its base path). The chart offers two modes instead.

### Separate host

The web and API each get their own hostname. Works with any ingress controller.

```yaml
ingress:
  enabled: true
  className: nginx
  host: app.example.com
  tls:
    enabled: true
    secretName: app-tls
  api:
    mode: separate-host
    host: api.example.com
    tls:
      enabled: true
      secretName: api-tls
```

### Traefik entrypoint

The API shares the web hostname but is served on a dedicated Traefik entrypoint (a separate port). Requires Traefik and
the `IngressRoute` CRD.

```yaml
ingress:
  enabled: true
  className: traefik
  host: app.example.com
  tls:
    enabled: true
    secretName: app-tls
  api:
    mode: traefik-entrypoint
    entryPoint: apisecure
    publicPort: 8443
    tls:
      enabled: true
      secretName: app-tls
```

## TLS with cert-manager

```yaml
certificate:
  enabled: true
  issuerName: letsencrypt-prod
  issuerKind: ClusterIssuer
  dnsNames:
    - app.example.com
    - api.example.com
```

The generated secret is named `<release>-itsaplan-tls`. Reference it in
`ingress.tls.secretName` and `ingress.api.tls.secretName`.

## External database

Disable the built-in PostgreSQL and provide a connection string:

```yaml
postgresql:
  enabled: false

externalDatabase:
  url: "postgres://user:password@db.example.com:5432/itsaplan"
```

## External S3

Disable the built-in MinIO and point to an external S3-compatible store:

```yaml
minio:
  enabled: false

externalS3:
  endpoint: "https://s3.us-east-1.amazonaws.com"

api:
  env:
    S3_BUCKET: "my-bucket"
    S3_REGION: "us-east-1"
    S3_FORCE_PATH_STYLE: "false"

secrets:
  s3AccessKeyId: "AKIA..."
  s3SecretAccessKey: "..."
```

`S3_FORCE_PATH_STYLE` is `false` for AWS and Cloudflare R2, `true` for MinIO.

## Secrets in production

The chart creates a Kubernetes Secret with plaintext `stringData`. For production, store secrets externally (Sealed
Secrets, External Secrets Operator, SOPS, etc.) and inject them via a values override or a secret store CSI driver.

## Upgrading

```bash
helm upgrade itsaplan charts/itsaplan -f values.yaml
```

Config and secret changes trigger a rolling restart automatically (the deployments carry a checksum annotation on the
ConfigMap and Secret).

## Disabling the Telegram bot

```yaml
bot:
  enabled: false
```

## Values reference

The full list of values with defaults is in [`charts/itsaplan/README.md`](../charts/itsaplan/README.md).

For Docker Compose, see [self-hosting.md](self-hosting.md). For a managed deploy, see
[coolify.md](coolify.md) or [railway.md](railway.md).