import { pinnedFetch } from '@repo/net';
import type { ToolConfig } from './types';

// A Streamable HTTP client over pinnedFetch, so the server URL passes the SSRF guard.
// pinnedFetch buffers the body, which suits the request-scoped SSE stream a server closes
// after its answer; the server-to-client stream (GET) is never opened.

export const MCP_INTEGRATION_KEY = 'mcp';
export const MCP_TOOL_PREFIX = 'mcp:';

const PROTOCOL_VERSION = '2025-06-18';
const TIMEOUT_MS = 30_000;
const MAX_BYTES = 5_000_000;

export class McpAuthRequiredError extends Error {}

export interface McpTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

interface JsonRpcResponse {
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

interface Session {
  request: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
}

// An SSE body may carry notifications before the answer.
function pickResponse(body: string, contentType: string, id: number): JsonRpcResponse | null {
  const messages = contentType.includes('text/event-stream')
    ? body
        .split(/\r?\n\r?\n/)
        .map((event) =>
          event
            .split(/\r?\n/)
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart())
            .join('\n'),
        )
        .filter(Boolean)
    : [body];
  for (const raw of messages) {
    try {
      const parsed = JSON.parse(raw) as JsonRpcResponse | JsonRpcResponse[];
      const found = (Array.isArray(parsed) ? parsed : [parsed]).find((m) => m.id === id);
      if (found) return found;
    } catch {
      continue;
    }
  }
  return null;
}

async function openSession(credential: ToolConfig): Promise<Session> {
  const url = String(credential.url ?? '');
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  if (credential.headerValue) {
    headers[String(credential.headerName || 'Authorization')] = String(credential.headerValue);
  }
  let nextId = 1;

  async function post(message: Record<string, unknown>): Promise<Response> {
    const res = await pinnedFetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', ...message }),
      timeoutMs: TIMEOUT_MS,
      maxBytes: MAX_BYTES,
    });
    if (res.status === 401) {
      throw new McpAuthRequiredError('The MCP server asks for authorization');
    }
    if (!res.ok && res.status !== 202) {
      const text = await res.text().catch(() => '');
      throw new Error(`MCP server answered ${res.status}${text ? `: ${text.slice(0, 300)}` : ''}`);
    }
    return res;
  }

  async function request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = nextId++;
    const res = await post({ id, method, ...(params ? { params } : {}) });
    const sessionId = res.headers.get('mcp-session-id');
    if (sessionId) headers['mcp-session-id'] = sessionId;
    const answer = pickResponse(await res.text(), res.headers.get('content-type') ?? '', id);
    if (!answer) throw new Error(`MCP server sent no answer to ${method}`);
    if (answer.error) throw new Error(`MCP ${method} failed: ${answer.error.message}`);
    return answer.result;
  }

  await request('initialize', {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'itsaplan', version: '1' },
  });
  headers['mcp-protocol-version'] = PROTOCOL_VERSION;
  await post({ method: 'notifications/initialized' });
  return { request };
}

export async function listMcpTools(credential: ToolConfig): Promise<McpTool[]> {
  const session = await openSession(credential);
  const tools: McpTool[] = [];
  let cursor: string | undefined;
  do {
    const page = (await session.request('tools/list', cursor ? { cursor } : undefined)) as {
      tools?: McpTool[];
      nextCursor?: string;
    };
    tools.push(...(page.tools ?? []));
    cursor = page.nextCursor;
  } while (cursor);
  return tools;
}

export async function callMcpTool(
  credential: ToolConfig,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const session = await openSession(credential);
  const result = (await session.request('tools/call', { name, arguments: args })) as {
    content?: { type: string; text?: string }[];
    structuredContent?: unknown;
    isError?: boolean;
  };
  if (result.isError) {
    const text = (result.content ?? []).map((c) => c.text ?? '').join('\n');
    throw new Error(text || `MCP tool ${name} failed`);
  }
  return result.structuredContent ?? result.content ?? null;
}
