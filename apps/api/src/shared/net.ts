import { lookup } from 'node:dns/promises';
import { HttpError } from './lib';

// SSRF guards for server-side fetches of a user/agent-supplied URL. A URL that
// resolves to a loopback, link-local, or private-range address could reach internal
// services (including the cloud metadata endpoint at 169.254.169.254), so those are
// rejected. The check runs at fetch time and resolves DNS, so a public hostname that
// points at a private address is caught too.

// A hostname that is inherently local (not an IP literal).
function isLocalHostname(host: string): boolean {
  return host === 'localhost' || host.endsWith('.local');
}

// An IPv4/IPv6 address in a loopback, link-local, or private range.
export function isPrivateIp(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 ||
      a === 127 || // loopback
      a === 10 || // private
      (a === 172 && b >= 16 && b <= 31) || // private
      (a === 192 && b === 168) || // private
      (a === 169 && b === 254) || // link-local (incl. cloud metadata)
      (a === 100 && b >= 64 && b <= 127) // CGNAT
    );
  }
  const v6 = ip.toLowerCase();
  return (
    v6 === '::1' || // loopback
    v6 === '::' ||
    v6.startsWith('fe80:') || // link-local
    /^f[cd][0-9a-f]{2}:/.test(v6) // unique local
  );
}

// Validates a user/agent-supplied URL for a server-side fetch: http(s) only, and it
// must not resolve to a local/private address. Returns the parsed URL. http is
// allowed only in local development (like validateWebhookUrl), production and tests
// require https. Throws HttpError(400) on any failure.
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, 'url must be a valid URL');
  }

  const devRelaxed = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';
  if (url.protocol !== 'https:' && !(devRelaxed && url.protocol === 'http:')) {
    throw new HttpError(400, 'url must use https');
  }

  const host = url.hostname.toLowerCase();
  if (isLocalHostname(host) || isPrivateIp(host)) {
    if (!devRelaxed) throw new HttpError(400, 'url must not point to a private or local address');
    return url;
  }

  // Resolve the hostname and reject if any address is private, so a public name that
  // points at an internal address cannot slip through.
  try {
    const addrs = await lookup(host, { all: true });
    if (addrs.some((a) => isPrivateIp(a.address)) && !devRelaxed) {
      throw new HttpError(400, 'url must not point to a private or local address');
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, 'url host could not be resolved');
  }
  return url;
}
