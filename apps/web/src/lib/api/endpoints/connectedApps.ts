import { request } from '@/lib/api/core/client';

// An OAuth application (an MCP client such as Claude or ChatGPT) the signed-in user
// let act on their behalf. lastUsedAt is when it was last issued a token, which every
// refresh does; null once only the consent is left.
export interface ConnectedApp {
  clientId: string;
  name: string;
  icon: string | null;
  scopes: string[];
  connectedAt: string;
  lastUsedAt: string | null;
}

export const getConnectedApps = () => request<ConnectedApp[]>('/account/connected-apps');

// Its tokens stop working at once, and connecting it again asks for consent again.
export const disconnectApp = (clientId: string) =>
  request<void>(`/account/connected-apps/${encodeURIComponent(clientId)}`, { method: 'DELETE' });
