export type McpCredential =
  | { kind: 'api-key'; apiKey: string }
  | { kind: 'oauth'; accessToken: string }
  // A user POST /mcp already authenticated by API key.
  | { kind: 'user'; userId: string };
