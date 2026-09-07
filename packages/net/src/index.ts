import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import type { LookupFunction } from 'node:net';
import { request as httpsRequest } from 'node:https';

// SSRF guards for server-side fetches of a user/agent-supplied URL. A URL that
// resolves to a loopback, link-local, or private-range address could reach internal
// services (including the cloud metadata endpoint at 169.254.169.254), so those are
// rejected. The check resolves DNS, so a public hostname that points at a private
// address is caught too.

export class UrlNotAllowedError extends Error {}

// A hostname that is inherently local (not an IP literal).
function isLocalHostname(host: string): boolean {
  return host === 'localhost' || host.endsWith('.local');
}

// IPv4-mapped and IPv4-compatible IPv6 addresses (`::ffff:127.0.0.1`, `::ffff:7f00:1`,
// `::127.0.0.1`) reach the same host as the IPv4 they carry, so they are compared as
// that IPv4 rather than as an IPv6 the range checks below would not recognise.
function toIpv4(ip: string): string {
  const embedded = ip.match(/^::(?:ffff:)?(.+)$/);
  if (!embedded) return ip;
  const rest = embedded[1]!;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(rest)) return rest;
  const hex = rest.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return ip;
  const n = ((parseInt(hex[1]!, 16) << 16) | parseInt(hex[2]!, 16)) >>> 0;
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

// An IPv4/IPv6 address in a loopback, link-local, or private range.
export function isPrivateIp(ip: string): boolean {
  const normalized = toIpv4(ip.toLowerCase());
  const v4 = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
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
  return (
    normalized === '::1' || // loopback
    normalized === '::' ||
    normalized.startsWith('fe80:') || // link-local
    /^f[cd][0-9a-f]{2}:/.test(normalized) // unique local
  );
}

interface Pin {
  address: string;
  family: number;
}

// Validates the URL and resolves its hostname once. `pin` is the address the caller
// must connect to; it is absent only when the host is already an IP literal.
async function vet(raw: string): Promise<{ url: URL; pin?: Pin }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UrlNotAllowedError('url must be a valid URL');
  }

  const devRelaxed = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';
  if (url.protocol !== 'https:' && !(devRelaxed && url.protocol === 'http:')) {
    throw new UrlNotAllowedError('url must use https');
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (isLocalHostname(host) || isPrivateIp(host)) {
    if (!devRelaxed) {
      throw new UrlNotAllowedError('url must not point to a private or local address');
    }
    return { url };
  }

  let addrs: Pin[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new UrlNotAllowedError('url host could not be resolved');
  }
  if (addrs.some((a) => isPrivateIp(a.address)) && !devRelaxed) {
    throw new UrlNotAllowedError('url must not point to a private or local address');
  }
  return { url, pin: addrs[0] };
}

// Validates a user/agent-supplied URL for a server-side fetch: http(s) only, and it
// must not resolve to a local/private address. Returns the parsed URL. http is
// allowed only in local development; production and tests require https. Throws
// UrlNotAllowedError on any failure.
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  return (await vet(raw)).url;
}

export interface PinnedRequestInit {
  method?: string;
  headers?: Record<string, string> | Headers;
  body?: string | Buffer;
  timeoutMs?: number;
}

// Validates the URL, then connects to the address that validation resolved instead of
// resolving the hostname a second time. Without the pin, a name that answers publicly
// during the check and privately during the connection (DNS rebinding) would defeat
// it. TLS still verifies against the hostname, so pinning does not weaken the
// certificate check. Redirects are never followed: the 3xx is returned as-is, so a
// caller cannot be steered to an address that was never validated.
export async function pinnedFetch(raw: string, init: PinnedRequestInit = {}): Promise<Response> {
  const { url, pin } = await vet(raw);
  const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
  const headers =
    init.headers instanceof Headers ? Object.fromEntries(init.headers) : (init.headers ?? {});

  return new Promise<Response>((resolve, reject) => {
    const req = send(
      url,
      {
        method: init.method ?? 'GET',
        headers,
        ...(pin
          ? {
              lookup: ((_host, options, cb) => {
                if (options.all) cb(null, [pin]);
                else cb(null, pin.address, pin.family);
              }) as LookupFunction,
            }
          : {}),
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('error', reject);
        res.on('end', () => {
          const status = res.statusCode ?? 502;
          // Response rejects a body on these statuses; the receiver sent none anyway.
          const empty = status < 200 || status === 204 || status === 205 || status === 304;
          resolve(
            new Response(empty ? null : Buffer.concat(chunks), {
              status,
              headers: Object.entries(res.headers).flatMap(([k, v]) =>
                v == null ? [] : [[k, Array.isArray(v) ? v.join(', ') : v] as [string, string]],
              ),
            }),
          );
        });
      },
    );
    req.on('error', reject);
    if (init.timeoutMs) {
      req.setTimeout(init.timeoutMs, () => req.destroy(new Error('request timed out')));
    }
    req.end(init.body);
  });
}
