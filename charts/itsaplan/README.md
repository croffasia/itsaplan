# itsaplan Helm Chart

Helm chart for deploying [It's a Plan](https://github.com/croffasia/itsaplan) on Kubernetes.

## Prerequisites

- Kubernetes 1.24+
- Helm 3.10+
- The published container images from `ghcr.io/croffasia/itsaplan-{api,web,worker,bot}`

## Quick start

```bash
helm install itsaplan charts/itsaplan \
  --set api.env.API_URL=https://api.example.com \
  --set api.env.APP_URL=https://app.example.com \
  --set api.env.S3_BUCKET=planner-attachments \
  --set secrets.postgresPassword=changeme \
  --set secrets.betterAuthSecret=$(openssl rand -base64 32) \
  --set secrets.appEncryptionKey=$(openssl rand -base64 32) \
  --set secrets.workerInternalToken=$(openssl rand -base64 32) \
  --set secrets.s3AccessKeyId=minioadmin \
  --set secrets.s3SecretAccessKey=minioadmin
```

This deploys the full stack with the built-in PostgreSQL and MinIO. For production, use a values file instead of `--set`
flags and store secrets externally (Sealed Secrets, External Secrets Operator, etc.).

## What gets deployed

| Resource          | Kind                        | Condition                              |
|-------------------|-----------------------------|----------------------------------------|
| API (Elysia)      | Deployment + Service        | always                                 |
| Web (Next.js)     | Deployment + Service        | always                                 |
| Worker            | Deployment                  | always                                 |
| Bot (Telegram)    | Deployment                  | `bot.enabled` (default `true`)         |
| PostgreSQL        | StatefulSet + Service + PVC | `postgresql.enabled` (default `true`)  |
| MinIO             | Deployment + Service + PVC  | `minio.enabled` (default `true`)       |
| MinIO bucket init | Job (Helm hook)             | `minio.enabled`                        |
| Web Ingress       | Ingress                     | `ingress.enabled`                      |
| API Ingress       | Ingress or IngressRoute     | `ingress.enabled` + `ingress.api.mode` |
| TLS Certificate   | Certificate (cert-manager)  | `certificate.enabled`                  |
| ServiceAccount    | ServiceAccount              | `serviceAccount.create`                |

## Using an external database

Disable the built-in PostgreSQL and provide a connection string:

```yaml
postgresql:
  enabled: false

externalDatabase:
  url: "postgres://user:password@db.example.com:5432/itsaplan"
```

## Using an external S3-compatible store

Disable the built-in MinIO and provide an endpoint:

```yaml
minio:
  enabled: false

externalS3:
  endpoint: "https://s3.us-east-1.amazonaws.com"

api:
  env:
    S3_BUCKET: "my-bucket"
    S3_REGION: "us-east-1"
    S3_FORCE_PATH_STYLE: "false"  # false for AWS/R2, true for MinIO

secrets:
  s3AccessKeyId: "AKIA..."
  s3SecretAccessKey: "..."
```

## Ingress

Ingress is disabled by default. Enable it and choose how the API is exposed.

The API cannot serve behind a path prefix: better-auth mounts at `/api/auth/*`
and treats a path inside `API_URL` as a replacement for its base path. The chart offers two modes instead.

### Separate host (default mode)

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

If cert-manager is installed, the chart can create a Certificate resource:

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

## Disabling the Telegram bot

```yaml
bot:
  enabled: false
```

## Values reference

### Global

| Key                  | Description                                                    | Default |
|----------------------|----------------------------------------------------------------|---------|
| `nameOverride`       | Override the chart name                                        | `""`    |
| `fullnameOverride`   | Override the full release name                                 | `""`    |
| `nodeSelector`       | Global node selector (per-component overrides take precedence) | `{}`    |
| `tolerations`        | Global tolerations                                             | `[]`    |
| `affinity`           | Global affinity                                                | `{}`    |
| `imagePullSecrets`   | Image pull secrets for private registries                      | `[]`    |
| `podSecurityContext` | Pod-level security context                                     | `{}`    |
| `securityContext`    | Container-level security context                               | `{}`    |

### Service account

| Key                          | Description                                | Default |
|------------------------------|--------------------------------------------|---------|
| `serviceAccount.create`      | Create a ServiceAccount                    | `false` |
| `serviceAccount.name`        | ServiceAccount name (defaults to fullname) | `""`    |
| `serviceAccount.annotations` | ServiceAccount annotations                 | `{}`    |

### API

| Key                                   | Description                                               | Default                          |
|---------------------------------------|-----------------------------------------------------------|----------------------------------|
| `api.replicaCount`                    | Number of API replicas                                    | `1`                              |
| `api.port`                            | Container port                                            | `3000`                           |
| `api.image.repository`                | Image repository                                          | `ghcr.io/croffasia/itsaplan-api` |
| `api.image.tag`                       | Image tag (defaults to `appVersion`)                      | `""`                             |
| `api.image.pullPolicy`                | Image pull policy                                         | `IfNotPresent`                   |
| `api.internalUrl`                     | Override internal API URL for inter-service communication | `""`                             |
| `api.env.API_URL`                     | Public API origin                                         | `""`                             |
| `api.env.APP_URL`                     | Public web origin                                         | `""`                             |
| `api.env.COOKIE_DOMAIN`               | Cookie domain override                                    | (unset)                          |
| `api.env.S3_BUCKET`                   | S3 bucket name                                            | `""`                             |
| `api.env.S3_REGION`                   | S3 region                                                 | `us-east-1`                      |
| `api.env.S3_FORCE_PATH_STYLE`         | S3 path-style access                                      | `"true"`                         |
| `api.env.TELEMETRY_DISABLED`          | Disable telemetry                                         | `"1"`                            |
| `api.resources`                       | CPU/memory requests and limits                            | `{}`                             |
| `api.nodeSelector`                    | Node selector                                             | `{}`                             |
| `api.tolerations`                     | Tolerations                                               | `[]`                             |
| `api.affinity`                        | Affinity                                                  | `{}`                             |
| `api.healthcheck.path`                | Health check path                                         | `/`                              |
| `api.healthcheck.initialDelaySeconds` | Readiness probe initial delay                             | `60`                             |
| `api.healthcheck.periodSeconds`       | Probe period                                              | `15`                             |
| `api.healthcheck.timeoutSeconds`      | Probe timeout                                             | `5`                              |
| `api.healthcheck.failureThreshold`    | Probe failure threshold                                   | `5`                              |

### Web

| Key                                   | Description                          | Default                          |
|---------------------------------------|--------------------------------------|----------------------------------|
| `web.replicaCount`                    | Number of web replicas               | `1`                              |
| `web.port`                            | Container port                       | `3001`                           |
| `web.image.repository`                | Image repository                     | `ghcr.io/croffasia/itsaplan-web` |
| `web.image.tag`                       | Image tag (defaults to `appVersion`) | `""`                             |
| `web.image.pullPolicy`                | Image pull policy                    | `IfNotPresent`                   |
| `web.env.HOSTNAME`                    | Bind address                         | `0.0.0.0`                        |
| `web.env.PRIVACY_URL`                 | Privacy policy URL                   | `""`                             |
| `web.env.TERMS_URL`                   | Terms of service URL                 | `""`                             |
| `web.resources`                       | CPU/memory requests and limits       | `{}`                             |
| `web.nodeSelector`                    | Node selector                        | `{}`                             |
| `web.tolerations`                     | Tolerations                          | `[]`                             |
| `web.affinity`                        | Affinity                             | `{}`                             |
| `web.healthcheck.path`                | Health check path                    | `/login`                         |
| `web.healthcheck.initialDelaySeconds` | Readiness probe initial delay        | `15`                             |
| `web.healthcheck.periodSeconds`       | Probe period                         | `15`                             |
| `web.healthcheck.timeoutSeconds`      | Probe timeout                        | `5`                              |
| `web.healthcheck.failureThreshold`    | Probe failure threshold              | `5`                              |

### Worker

| Key                             | Description                          | Default                             |
|---------------------------------|--------------------------------------|-------------------------------------|
| `worker.replicaCount`           | Number of worker replicas            | `1`                                 |
| `worker.image.repository`       | Image repository                     | `ghcr.io/croffasia/itsaplan-worker` |
| `worker.image.tag`              | Image tag (defaults to `appVersion`) | `""`                                |
| `worker.image.pullPolicy`       | Image pull policy                    | `IfNotPresent`                      |
| `worker.env.TELEMETRY_DISABLED` | Disable telemetry                    | `"1"`                               |
| `worker.env.DO_NOT_TRACK`       | Do not track                         | `"1"`                               |
| `worker.resources`              | CPU/memory requests and limits       | `{}`                                |
| `worker.nodeSelector`           | Node selector                        | `{}`                                |
| `worker.tolerations`            | Tolerations                          | `[]`                                |
| `worker.affinity`               | Affinity                             | `{}`                                |

### Bot

| Key                    | Description                          | Default                          |
|------------------------|--------------------------------------|----------------------------------|
| `bot.enabled`          | Deploy the Telegram bot              | `true`                           |
| `bot.image.repository` | Image repository                     | `ghcr.io/croffasia/itsaplan-bot` |
| `bot.image.tag`        | Image tag (defaults to `appVersion`) | `""`                             |
| `bot.image.pullPolicy` | Image pull policy                    | `IfNotPresent`                   |
| `bot.resources`        | CPU/memory requests and limits       | `{}`                             |
| `bot.nodeSelector`     | Node selector                        | `{}`                             |
| `bot.tolerations`      | Tolerations                          | `[]`                             |
| `bot.affinity`         | Affinity                             | `{}`                             |

### Ingress

| Key                          | Description                             | Default         |
|------------------------------|-----------------------------------------|-----------------|
| `ingress.enabled`            | Enable ingress                          | `false`         |
| `ingress.className`          | Ingress class name                      | `""`            |
| `ingress.annotations`        | Ingress annotations                     | `{}`            |
| `ingress.host`               | Web hostname                            | `""`            |
| `ingress.tls.enabled`        | Enable TLS on the web ingress           | `false`         |
| `ingress.tls.secretName`     | TLS secret name                         | `""`            |
| `ingress.api.mode`           | `separate-host` or `traefik-entrypoint` | `separate-host` |
| `ingress.api.host`           | API hostname (separate-host mode)       | `""`            |
| `ingress.api.entryPoint`     | Traefik entrypoint name                 | `""`            |
| `ingress.api.publicPort`     | Traefik entrypoint public port          | `8443`          |
| `ingress.api.tls.enabled`    | Enable TLS on the API ingress           | `false`         |
| `ingress.api.tls.secretName` | API TLS secret name                     | `""`            |

### Certificate (cert-manager)

| Key                      | Description                       | Default            |
|--------------------------|-----------------------------------|--------------------|
| `certificate.enabled`    | Create a cert-manager Certificate | `false`            |
| `certificate.issuerName` | Issuer name                       | `letsencrypt-prod` |
| `certificate.issuerKind` | Issuer kind                       | `ClusterIssuer`    |
| `certificate.dnsNames`   | DNS names for the certificate     | `[]`               |

### Secrets

| Key                           | Description                               | Default |
|-------------------------------|-------------------------------------------|---------|
| `secrets.postgresPassword`    | PostgreSQL password                       | `""`    |
| `secrets.betterAuthSecret`    | better-auth secret                        | `""`    |
| `secrets.appEncryptionKey`    | AES encryption key for secrets at rest    | `""`    |
| `secrets.workerInternalToken` | Shared token between api, worker, and bot | `""`    |
| `secrets.s3AccessKeyId`       | S3 access key (also MinIO root user)      | `""`    |
| `secrets.s3SecretAccessKey`   | S3 secret key (also MinIO root password)  | `""`    |

### External services

| Key                    | Description                                                       | Default |
|------------------------|-------------------------------------------------------------------|---------|
| `externalDatabase.url` | Database connection string (when `postgresql.enabled` is `false`) | `""`    |
| `externalS3.endpoint`  | S3 endpoint URL (when `minio.enabled` is `false`)                 | `""`    |

### PostgreSQL

| Key                                   | Description                                | Default     |
|---------------------------------------|--------------------------------------------|-------------|
| `postgresql.enabled`                  | Deploy PostgreSQL in-cluster               | `true`      |
| `postgresql.database`                 | Database name                              | `itsaplan`  |
| `postgresql.username`                 | Database user                              | `itsaplan`  |
| `postgresql.image.repository`         | Image repository                           | `postgres`  |
| `postgresql.image.tag`                | Image tag                                  | `17-alpine` |
| `postgresql.persistence.size`         | PVC size                                   | `10Gi`      |
| `postgresql.persistence.storageClass` | Storage class (empty = cluster default)    | `""`        |
| `postgresql.podAnnotations`           | Pod annotations (e.g. Velero backup hooks) | `{}`        |
| `postgresql.resources`                | CPU/memory requests and limits             | `{}`        |
| `postgresql.nodeSelector`             | Node selector                              | `{}`        |
| `postgresql.tolerations`              | Tolerations                                | `[]`        |
| `postgresql.affinity`                 | Affinity                                   | `{}`        |

### MinIO

| Key                              | Description                             | Default                        |
|----------------------------------|-----------------------------------------|--------------------------------|
| `minio.enabled`                  | Deploy MinIO in-cluster                 | `true`                         |
| `minio.bucket`                   | Bucket name to create                   | `planner-attachments`          |
| `minio.image.repository`         | Image repository                        | `minio/minio`                  |
| `minio.image.tag`                | Image tag                               | `RELEASE.2025-04-22T22-12-26Z` |
| `minio.mcImage.repository`       | MinIO Client image repository           | `minio/mc`                     |
| `minio.mcImage.tag`              | MinIO Client image tag                  | `RELEASE.2025-04-16T18-13-36Z` |
| `minio.persistence.size`         | PVC size                                | `20Gi`                         |
| `minio.persistence.storageClass` | Storage class (empty = cluster default) | `""`                           |
| `minio.resources`                | CPU/memory requests and limits          | `{}`                           |
| `minio.nodeSelector`             | Node selector                           | `{}`                           |
| `minio.tolerations`              | Tolerations                             | `[]`                           |
| `minio.affinity`                 | Affinity                                | `{}`                           |
