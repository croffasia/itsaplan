import { API_URL } from '@/lib/api';

// The MCP endpoint clients connect to; the transport is Streamable HTTP at /mcp.
export const MCP_URL = `${API_URL}/mcp`;

interface McpClient {
  // Product names stay as they are written by their makers; only the generic entry
  // carries a key instead (labelKey), and the prose notes are translated by key.
  label: string;
  labelKey?: 'other';
  file?: string;
  noteKey?: 'claudeCode' | 'vscode' | 'claudeDesktop' | 'other';
  code: string;
}

// Every client uses the same endpoint and a Bearer API key; only the file and the
// key holding the URL/headers differ, taken verbatim from each tool's own docs.
// <API_KEY> is a placeholder the user swaps for a personal key.
export const MCP_CLIENTS: McpClient[] = [
  {
    label: 'Claude Code',
    noteKey: 'claudeCode',
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
    noteKey: 'vscode',
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
    noteKey: 'claudeDesktop',
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
    labelKey: 'other',
    noteKey: 'other',
    code: MCP_URL,
  },
];
