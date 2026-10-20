import { app } from '../../app';
import { routeTools } from '../../mcp/generate';

// The routes matching `match` that carry no MCP tool tag, as "METHOD /path". A route
// opts in with mcpTool() in its detail, so a feature's test pins which of its routes
// stay session-only.
export function untaggedRoutes(match: (route: string) => boolean): string[] {
  const tagged = new Set(routeTools(app).map((tool) => `${tool.method} ${tool.path}`));
  return app.routes
    .map((route) => `${route.method} ${route.path}`)
    .filter(match)
    .filter((route) => !tagged.has(route));
}

const REDIRECT_URI = 'https://client.example.com/callback';
const MCP_RESOURCE = `${process.env.API_URL}/mcp`;
// The RFC 7636 example pair: the challenge is the S256 of the verifier.
const CODE_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CODE_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

export async function registerMcpClient(name = 'Test client'): Promise<string> {
  const registered = await app.handle(
    new Request('http://localhost/api/auth/oauth2/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        redirect_uris: [REDIRECT_URI],
        token_endpoint_auth_method: 'none',
        client_name: name,
      }),
    }),
  );
  return ((await registered.json()) as { client_id: string }).client_id;
}

// Where the authorize endpoint sends the person: the consent page while the client has
// no consent from them, straight back to the client with a code once it has.
export async function authorizeMcpClient(
  cookie: string,
  clientId: string,
  scope = 'openid',
): Promise<URL> {
  const authorize = await app.handle(
    new Request(
      `http://localhost/api/auth/oauth2/authorize?${new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        code_challenge: CODE_CHALLENGE,
        code_challenge_method: 'S256',
        scope,
        state: 'st',
        resource: MCP_RESOURCE,
      })}`,
      { headers: { cookie } },
    ),
  );
  return new URL(authorize.headers.get('location') ?? '');
}

// The MCP OAuth token a person gets by approving a client: authorize with their session,
// consent, and exchange the code.
export async function connectMcpClient(
  cookie: string,
  clientId: string,
  scope = 'openid',
): Promise<string> {
  // The consent page receives the signed authorization request and posts it back.
  const consentPage = await authorizeMcpClient(cookie, clientId, scope);
  const consent = await app.handle(
    new Request('http://localhost/api/auth/oauth2/consent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ accept: true, oauth_query: consentPage.search.slice(1) }),
    }),
  );
  const { url } = (await consent.json()) as { url: string };
  const token = await exchangeMcpCode(clientId, new URL(url).searchParams.get('code') ?? '');
  return ((await token.json()) as { access_token: string }).access_token;
}

export function exchangeMcpCode(clientId: string, code: string): Promise<Response> {
  return app.handle(
    new Request('http://localhost/api/auth/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: clientId,
        code_verifier: CODE_VERIFIER,
      }),
    }),
  );
}

export async function mcpAccessToken(cookie: string): Promise<string> {
  return connectMcpClient(cookie, await registerMcpClient());
}
