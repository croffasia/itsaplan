{{/*
Expand the name of the chart.
*/}}
{{- define "itsaplan.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "itsaplan.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "itsaplan.labels" -}}
helm.sh/chart: {{ include "itsaplan.name" . }}-{{ .Chart.Version | replace "+" "_" }}
{{ include "itsaplan.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels.
*/}}
{{- define "itsaplan.selectorLabels" -}}
app.kubernetes.io/name: {{ include "itsaplan.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Compute the DATABASE_URL.
When the built-in PostgreSQL is enabled, build the URL from the release name.
Otherwise, use the override in .Values.externalDatabase.url.
*/}}
{{- define "itsaplan.databaseUrl" -}}
{{- if .Values.externalDatabase.url }}
{{- .Values.externalDatabase.url }}
{{- else if .Values.postgresql.enabled }}
{{- printf "postgres://%s:%s@%s-postgresql:5432/%s" .Values.postgresql.username .Values.secrets.postgresPassword (include "itsaplan.fullname" .) .Values.postgresql.database }}
{{- else }}
{{- fail "Either postgresql.enabled must be true or externalDatabase.url must be set" }}
{{- end }}
{{- end }}

{{/*
Compute the S3 endpoint.
When the built-in MinIO is enabled, use the internal MinIO service URL.
Otherwise, use the override in .Values.externalS3.endpoint.
*/}}
{{- define "itsaplan.s3Endpoint" -}}
{{- if .Values.externalS3.endpoint }}
{{- .Values.externalS3.endpoint }}
{{- else if .Values.minio.enabled }}
{{- printf "http://%s-minio:9000" (include "itsaplan.fullname" .) }}
{{- else }}
{{- fail "Either minio.enabled must be true or externalS3.endpoint must be set" }}
{{- end }}
{{- end }}

{{/*
Compute the internal API URL for inter-service communication.
*/}}
{{- define "itsaplan.internalApiUrl" -}}
{{- if .Values.api.internalUrl }}
{{- .Values.api.internalUrl }}
{{- else }}
{{- printf "http://%s-api:%d" (include "itsaplan.fullname" .) (int .Values.api.port) }}
{{- end }}
{{- end }}