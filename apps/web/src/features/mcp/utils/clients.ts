// The MCP endpoint clients connect to. NEXT_PUBLIC_API_URL is the API origin
// (mandatory build-time config); the transport is Streamable HTTP at /mcp.
export const MCP_URL = `${process.env.NEXT_PUBLIC_API_URL}/mcp`;

interface McpClient {
  label: string;
  file?: string;
  note?: string;
  code: string;
}

// Every client uses the same endpoint and a Bearer API key; only the file and the
// key holding the URL/headers differ, taken verbatim from each tool's own docs.
// <API_KEY> is a placeholder the user swaps for a personal key.
export const MCP_CLIENTS: McpClient[] = [
  {
    label: 'Claude Code',
    note: 'Run this in your terminal.',
    code: `claude mcp add --transport http plan ${MCP_URL} \\
  --header "Authorization: Bearer <API_KEY>"`,
  },
  {
    label: 'Cursor',
    file: '~/.cursor/mcp.json',
    code: `{
  "mcpServers": {
    "plan": {
      "url": "${MCP_URL}",
      "headers": { "Authorization": "Bearer <API_KEY>" }
    }
  }
}`,
  },
  {
    label: 'VS Code',
    file: '.vscode/mcp.json',
    note: 'Needs GitHub Copilot. The root key is "servers", not "mcpServers".',
    code: `{
  "servers": {
    "plan": {
      "type": "http",
      "url": "${MCP_URL}",
      "headers": { "Authorization": "Bearer <API_KEY>" }
    }
  }
}`,
  },
  {
    label: 'Windsurf',
    file: '~/.codeium/windsurf/mcp_config.json',
    note: 'Windsurf uses "serverUrl", not "url".',
    code: `{
  "mcpServers": {
    "plan": {
      "serverUrl": "${MCP_URL}",
      "headers": { "Authorization": "Bearer <API_KEY>" }
    }
  }
}`,
  },
  {
    label: 'Claude Desktop',
    file: 'claude_desktop_config.json',
    note: 'Claude Desktop reaches remote servers through the mcp-remote bridge (needs Node.js).',
    code: `{
  "mcpServers": {
    "plan": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote", "${MCP_URL}",
        "--header", "Authorization: Bearer <API_KEY>"
      ]
    }
  }
}`,
  },
  {
    label: 'Other',
    note: 'Any client that speaks MCP over Streamable HTTP works: point it at the endpoint and send an Authorization: Bearer <API_KEY> header.',
    code: MCP_URL,
  },
];
