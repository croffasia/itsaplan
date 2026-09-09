import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import type { LookupFunction } from 'node:net';
import { request as httpsRequest } from 'node:https';

// SSRF guards for server-side fetches of a user/agent-supplied URL. A URL that
// resolves to a loopback, link-local, or private-range address could reach internal
// services (including the cloud metadata endpoint at 169.254.169.254), so those are
// rejected. The check resolves DNS, so a public hostname that points at a private
// address is caught too.
//
// SSRF_ALLOWED_HOSTS names the hosts an operator has decided to trust anyway — see
// isAllowedHost below. It is empty by default.

export class UrlNotAllowedError extends Error {}

// A hostname that is inherently local (not an IP literal).
function isLocalHostname(host: string): boolean {
  return host === 'localhost' || host.endsWith('.local');
}

// Hosts the operator has explicitly trusted even though they resolve privately.
//
// The rules above are right for a URL that arrives as content — a webhook target, an
// attachment to import. A self-hosted repository host is different: its address is
// configuration, entered by someone who already administers the project's
// integrations, and on a self-hosted instance it is normally a private one. Without
// an escape hatch, connecting an instance to a Gitea, Forgejo, or GitLab on the same
// network cannot be expressed at all.
//
// Empty by default, so nothing is exempt unless it is named. Matching is on the exact
// hostname — no wildcards, no CIDR ranges, no suffix matching — so naming one host
// trusts one host. Everything else still applies to it: https is still required, and
// the resolved address is still pinned, so a name on this list cannot be used to
// mount a DNS-rebinding attack either.
//
// Read per call rather than at module load so a test can set it around one case.
function isAllowedHost(host: string): boolean {
  const configured = process.env.SSRF_ALLOWED_HOSTS;
  if (!configured) return false;
  return configured
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(host);
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

// http is allowed only in local development; production and tests require https.
function isDevRelaxed(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';
}

interface Checked {
  url: URL;
  host: string;
  allowed: boolean;
  // The host is an IP literal or an inherently local name, so there is nothing to
  // resolve.
  literal: boolean;
}

// The checks that need no DNS lookup: the URL parses, uses https, and a literal or
// inherently local host is not private unless SSRF_ALLOWED_HOSTS names it.
function check(raw: string): Checked {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UrlNotAllowedError('url must be a valid URL');
  }

  const devRelaxed = isDevRelaxed();
  if (url.protocol !== 'https:' && !(devRelaxed && url.protocol === 'http:')) {
    throw new UrlNotAllowedError('url must use https');
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const allowed = isAllowedHost(host);
  const literal = isLocalHostname(host) || isPrivateIp(host);
  if (literal && !devRelaxed && !allowed) {
    throw new UrlNotAllowedError('url must not point to a private or local address');
  }
  return { url, host, allowed, literal };
}

// Validates the URL and resolves its hostname once. `pin` is the address the caller
// must connect to; it is absent only when the host is already an IP literal.
async function vet(raw: string): Promise<{ url: URL; pin?: Pin }> {
  const { url, host, allowed, literal } = check(raw);
  if (literal) return { url };

  let addrs: Pin[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new UrlNotAllowedError('url host could not be resolved');
  }
  if (addrs.some((a) => isPrivateIp(a.address)) && !isDevRelaxed() && !allowed) {
    throw new UrlNotAllowedError('url must not point to a private or local address');
  }
  return { url, pin: addrs[0] };
}

// The synchronous subset of assertPublicHttpUrl, for a URL that is stored now and
// fetched later: http(s) only, and a literal or local host must not be private. It
// does not resolve the hostname, so the fetch itself still has to go through
// pinnedFetch or assertPublicHttpUrl. Throws UrlNotAllowedError on any failure.
export function checkHttpUrl(raw: string): URL {
  return check(raw).url;
}

// Validates a user/agent-supplied URL for a server-side fetch: http(s) only, and it
// must not resolve to a local/private address. Returns the parsed URL. Throws
// UrlNotAllowedError on any failure.
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  return (await vet(raw)).url;
}

// node's http client sends no User-Agent of its own, and GitHub answers 403 with an
// HTML body to a request that carries none. The global fetch this replaced always sent
// one, so callers never had to.
const DEFAULT_USER_AGENT = 'itsaplan/1';

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
    init.headers instanceof Headers
      ? Object.fromEntries(init.headers)
      : { ...(init.headers ?? {}) };
  if (!Object.keys(headers).some((name) => name.toLowerCase() === 'user-agent')) {
    headers['user-agent'] = DEFAULT_USER_AGENT;
  }

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
