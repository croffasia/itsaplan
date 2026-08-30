import type { ElysiaSwaggerConfig } from '@elysiajs/swagger';

type OpenApiDocument = NonNullable<ElysiaSwaggerConfig['documentation']>;
type Paths = NonNullable<OpenApiDocument['paths']>;
type PathItem = NonNullable<Paths[string]>;
type Operation = NonNullable<PathItem['get']>;

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
const GENERIC_CONTENT_TYPES = ['application/json', 'multipart/form-data', 'text/plain'];

const MULTIPART_OPERATIONS = new Set([
  'POST /issues/{issueId}/attachments',
  'PUT /attachments/{publicId}',
  'POST /me/avatar',
  'POST /projects/{projectKey}/agent-skills/{skillId}/references',
]);

const PUBLIC_GET_PATHS = [
  /^\/$/,
  /^\/auth-config$/,
  /^\/attachments\/\{publicId\}\/raw$/,
  /^\/chat-attachments\/\{publicId\}\/raw$/,
  /^\/avatars\/\{id\}\/raw$/,
  /^\/invites\/\{token\}$/,
  /^\/share\//,
];

const GIT_WEBHOOK_SECURITY: NonNullable<Operation['security']> = [
  { gitHubSignature: [] },
  { gitLabToken: [] },
  { giteaSignature: [] },
  { forgejoSignature: [] },
  { bitbucketSignature: [] },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOpenApiDocument(value: unknown): value is OpenApiDocument & { paths: Paths } {
  return isRecord(value) && isRecord(value.paths);
}

function operationAt(pathItem: PathItem, method: (typeof METHODS)[number]): Operation | undefined {
  return pathItem[method] as Operation | undefined;
}

function mediaTypeFor(path: string, method: string): string {
  if (path.startsWith('/scim/v2/')) return 'application/scim+json';
  if (MULTIPART_OPERATIONS.has(`${method.toUpperCase()} ${path}`)) return 'multipart/form-data';
  return 'application/json';
}

function normalizeContent(
  content: Record<string, unknown> | undefined,
  mediaType: string,
): Record<string, unknown> | undefined {
  if (!content) return undefined;
  const keys = Object.keys(content);
  if (!keys.some((key) => GENERIC_CONTENT_TYPES.includes(key))) return content;
  const schema = content[mediaType] ?? content['application/json'] ?? content[keys[0]!];
  return schema === undefined ? content : { [mediaType]: schema };
}

function normalizeOperationContent(operation: Operation, path: string, method: string): void {
  const requestBody = operation.requestBody;
  if (requestBody && 'content' in requestBody && requestBody.content) {
    if (path === '/webhooks/git/{webhookId}' || path === '/webhooks/github/{webhookId}') {
      requestBody.content = {
        'application/json': {
          schema: {
            type: 'object',
            additionalProperties: true,
            description: 'The provider webhook payload. The exact shape depends on the event.',
          },
        },
      };
    } else {
      requestBody.content = normalizeContent(
        requestBody.content as Record<string, unknown>,
        mediaTypeFor(path, method),
      ) as typeof requestBody.content;
    }
  }

  const responseMediaType = path.startsWith('/scim/v2/')
    ? 'application/scim+json'
    : 'application/json';
  for (const response of Object.values(operation.responses ?? {})) {
    if (!response || !('content' in response) || !response.content) continue;
    response.content = normalizeContent(
      response.content as Record<string, unknown>,
      responseMediaType,
    ) as typeof response.content;
  }
}

function normalizeOperationSecurity(operation: Operation, path: string, method: string): void {
  if (path.startsWith('/scim/v2/')) {
    operation.tags = ['SCIM'];
    operation.security = [{ scimBearer: [] }];
    return;
  }
  if (path.startsWith('/internal/')) {
    operation.security = [{ workerToken: [] }];
    return;
  }
  if (path === '/webhooks/git/{webhookId}' || path === '/webhooks/github/{webhookId}') {
    operation.security = GIT_WEBHOOK_SECURITY;
    return;
  }
  if (path === '/me' && method === 'get') {
    operation.security = [{}, { apiKey: [] }];
    return;
  }
  if (method === 'get' && PUBLIC_GET_PATHS.some((pattern) => pattern.test(path))) {
    operation.security = [];
  }
}

function ensureDescription(operation: Operation): void {
  if (operation.description || !operation.summary) return;
  operation.description =
    `${operation.summary}. ` +
    'The request and response schemas below are generated from the validation used by the API.';
}

export function normalizeOpenApiDocument(document: OpenApiDocument & { paths: Paths }) {
  for (const [path, pathItem] of Object.entries(document.paths)) {
    if (!pathItem) continue;
    for (const method of METHODS) {
      const operation = operationAt(pathItem, method);
      if (!operation) continue;
      normalizeOperationSecurity(operation, path, method);
      normalizeOperationContent(operation, path, method);
      ensureDescription(operation);
    }
  }
  return document;
}

export function normalizeOpenApiResponse(request: Request, response: unknown): unknown {
  if (new URL(request.url).pathname !== '/docs/json' || !isOpenApiDocument(response)) return;
  return normalizeOpenApiDocument(response);
}
