import type { Integration } from '../../types';
import { MCP_INTEGRATION_KEY } from '../../mcp';

// Its tools come from the server's tools/list (see mcp.ts).
export const mcp: Integration = {
  key: MCP_INTEGRATION_KEY,
  label: 'MCP server',
  credentialSchema: [
    {
      key: 'url',
      label: 'Server URL',
      type: 'url',
      required: true,
      placeholder: 'https://example.com/mcp',
      help: 'The Streamable HTTP endpoint of the server.',
    },
    {
      key: 'headerName',
      label: 'Auth header name',
      type: 'string',
      required: false,
      placeholder: 'Authorization',
    },
    {
      key: 'headerValue',
      label: 'Auth header value',
      type: 'secret',
      required: false,
      placeholder: 'Bearer …',
    },
  ],
  tools: [],
};
