import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { t } from 'elysia';
import { writeBobAudit } from './audit';
import { resolveBobContext } from './identity';
import { logBobFailure } from './log';
import { bobMcpRateLimiter } from './rate-limit';
import { buildBobMcpServer, type BobRequestAudit } from './server';
import {
  BOB_ACTOR,
  bearerToken,
  constantTimeTokenMatches,
  createAuditEvent,
  sanitizeErrorCode,
  withTimeout,
} from './security';

const ENDPOINT = '/mcp/v1/bob';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 256 * 1024;
const TOOL_NAMES = new Set([
  'get_dashboard_summary',
  'list_projects',
  'get_project',
  'list_tasks',
  'get_task',
  'list_braindump_entries',
  'list_mind_facts',
  'list_competitors',
  'list_competitor_alerts',
  'list_agent_runs',
]);

function requestId(request: Request): string {
  const supplied = request.headers.get('x-request-id');
  return supplied &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(supplied)
    ? supplied
    : crypto.randomUUID();
}

function toolName(body: unknown): string {
  if (!body || typeof body !== 'object') return 'protocol.unknown';
  const rpc = body as { method?: unknown; params?: { name?: unknown } };
  if (rpc.method === 'tools/call' && typeof rpc.params?.name === 'string') {
    return rpc.params.name.slice(0, 100);
  }
  return typeof rpc.method === 'string'
    ? `protocol.${rpc.method.slice(0, 80)}`
    : 'protocol.unknown';
}

function productionHttps(request: Request): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  const forwarded = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  return forwarded === 'https' || new URL(request.url).protocol === 'https:';
}

function json(status: number, body: Record<string, unknown>, id: string): Response {
  return Response.json(body, { status, headers: { 'x-request-id': id } });
}

async function boundedResponse(response: Response, id: string): Promise<Response> {
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_RESPONSE_BYTES) {
    return json(413, { error: 'Response limit exceeded', requestId: id }, id);
  }
  const headers = new Headers(response.headers);
  headers.set('x-request-id', id);
  return new Response(bytes, { status: response.status, statusText: response.statusText, headers });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountBobMcp(app: any): void {
  app.post(
    ENDPOINT,
    async ({ request, body }: { request: Request; body: unknown }) => {
      const id = requestId(request);
      const startedAt = performance.now();
      const name = toolName(body);
      let projectId: number | null = null;
      const audit: BobRequestAudit = {
        requestId: id,
        startedAt,
        toolName: name,
        resourceId: null,
        resultStatus: name.startsWith('protocol.') || TOOL_NAMES.has(name) ? 'success' : 'error',
        recordCount: 0,
        errorCode: TOOL_NAMES.has(name) || name.startsWith('protocol.') ? null : 'invalid_request',
      };

      const finish = async (response: Response) => {
        await writeBobAudit(
          createAuditEvent({
            requestId: id,
            toolName: audit.toolName,
            projectId,
            resourceId: audit.resourceId,
            resultStatus: audit.resultStatus,
            durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
            recordCount: audit.recordCount,
            errorCode: audit.errorCode,
          }),
        );
        return response;
      };

      if (!productionHttps(request)) {
        audit.resultStatus = 'denied';
        audit.errorCode = 'https_required';
        return finish(json(400, { error: 'HTTPS required', requestId: id }, id));
      }

      const expected = process.env.VEXOL_BOB_MCP_TOKEN ?? '';
      const candidate = bearerToken(request) ?? '';
      if (expected.length < 32 || !constantTimeTokenMatches(candidate, expected)) {
        audit.resultStatus = 'denied';
        audit.errorCode = 'unauthorized';
        return finish(json(401, { error: 'Unauthorized' }, id));
      }

      const contentLength = Number(request.headers.get('content-length') ?? 0);
      if (contentLength > 64 * 1024) {
        audit.resultStatus = 'denied';
        audit.errorCode = 'invalid_request';
        return finish(json(413, { error: 'Request limit exceeded', requestId: id }, id));
      }

      if (!bobMcpRateLimiter.take(BOB_ACTOR)) {
        audit.resultStatus = 'denied';
        audit.errorCode = 'rate_limited';
        return finish(json(429, { error: 'Too many requests', requestId: id }, id));
      }

      let server: ReturnType<typeof buildBobMcpServer> | undefined;
      try {
        const context = await resolveBobContext();
        projectId = context.project.id;
        server = buildBobMcpServer(context, audit);
        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });
        await server.connect(transport);
        const response = await withTimeout(
          transport.handleRequest(request, { parsedBody: body }),
          REQUEST_TIMEOUT_MS,
        );
        const bounded = await boundedResponse(response, id);
        if (bounded.status >= 400 && audit.resultStatus === 'success') {
          audit.resultStatus = 'error';
          audit.errorCode = 'invalid_request';
        }
        return finish(bounded);
      } catch (error) {
        audit.resultStatus = 'error';
        audit.errorCode = sanitizeErrorCode(error);
        // A transport-level fault never reaches the tool handler's logging.
        logBobFailure(
          {
            requestId: id,
            toolName: audit.toolName,
            durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
            errorCode: audit.errorCode,
          },
          error,
        );
        const status = audit.errorCode === 'timeout' ? 504 : 403;
        const message = status === 504 ? 'Request timed out' : 'Service unavailable';
        return finish(json(status, { error: message, requestId: id }, id));
      } finally {
        await server?.close().catch(() => undefined);
      }
    },
    {
      body: t.Any(),
      detail: { summary: 'Bob read-only MCP Streamable HTTP endpoint', hide: true },
    },
  );
}
