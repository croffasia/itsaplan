import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { isIP, type LookupFunction } from 'node:net';
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

interface UrlPolicy {
  // Public content never uses development or configured private-host exceptions.
  publicOnly?: boolean;
  signal?: AbortSignal;
}

function isNonPublicIp(ip: string): boolean {
  const normalized = toIpv4(ip.toLowerCase());
  if (isPrivateIp(normalized)) return true;
  if (isIP(normalized) === 4) {
    const [a, b, c] = normalized.split('.').map(Number);
    return (
      a! >= 224 ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  return (
    !/^[23][0-9a-f]{3}:/.test(normalized) ||
    (normalized.startsWith('2001:') && parseInt(normalized.split(':')[1] || '0', 16) < 0x200) ||
    normalized.startsWith('2001:db8:') ||
    normalized.startsWith('3fff:') ||
    normalized.startsWith('2002:')
  );
}

// Validates the URL and resolves its hostname once. `pin` is the address the caller
// must connect to; it is absent only when the host is already an IP literal.
async function vet(raw: string, policy: UrlPolicy = {}): Promise<{ url: URL; pin?: Pin }> {
  policy.signal?.throwIfAborted();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UrlNotAllowedError('url must be a valid URL');
  }

  const devRelaxed =
    !policy.publicOnly && process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';
  if (
    url.protocol !== 'https:' &&
    !((devRelaxed || policy.publicOnly) && url.protocol === 'http:')
  ) {
    throw new UrlNotAllowedError('url must use https');
  }
  if (policy.publicOnly && (url.username || url.password)) {
    throw new UrlNotAllowedError('url must not include credentials');
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const allowed = !policy.publicOnly && isAllowedHost(host);
  const blockedIp = policy.publicOnly ? isNonPublicIp : isPrivateIp;
  if (isLocalHostname(host) || (isIP(host) && blockedIp(host))) {
    if (!devRelaxed && !allowed) {
      throw new UrlNotAllowedError('url must not point to a private or local address');
    }
    return { url };
  }

  let addrs: Pin[];
  let abort: (() => void) | undefined;
  try {
    const resolution = lookup(host, { all: true });
    if (policy.signal) {
      const signal = policy.signal;
      addrs = await Promise.race([
        resolution,
        new Promise<never>((_resolve, reject) => {
          abort = () => reject(signal.reason);
          signal.addEventListener('abort', abort, { once: true });
          if (signal.aborted) abort();
        }),
      ]);
    } else {
      addrs = await resolution;
    }
  } catch {
    policy.signal?.throwIfAborted();
    throw new UrlNotAllowedError('url host could not be resolved');
  } finally {
    if (abort) policy.signal?.removeEventListener('abort', abort);
  }
  if ((!addrs.length || addrs.some((a) => blockedIp(a.address))) && !devRelaxed && !allowed) {
    throw new UrlNotAllowedError('url must not point to a private or local address');
  }
  return { url, pin: addrs[0] };
}

// Validates a user/agent-supplied URL for a server-side fetch: http(s) only, and it
// must not resolve to a local/private address. Returns the parsed URL. http is
// allowed in local development or under the public-only policy. Throws
// UrlNotAllowedError when the URL or its resolved addresses are refused.
export async function assertPublicHttpUrl(raw: string, policy?: UrlPolicy): Promise<URL> {
  return (await vet(raw, policy)).url;
}

// node's http client sends no User-Agent of its own, and GitHub answers 403 with an
// HTML body to a request that carries none. The global fetch this replaced always sent
// one, so callers never had to.
const DEFAULT_USER_AGENT = 'itsaplan/1';

export interface PinnedRequestInit extends UrlPolicy {
  method?: string;
  headers?: Record<string, string> | Headers;
  body?: string | Buffer;
  timeoutMs?: number;
  maxBytes?: number;
  // Keep a document prefix for metadata; binary downloads must reject oversized bodies.
  truncateBody?: boolean;
}

// Validates the URL, then connects to the address that validation resolved instead of
// resolving the hostname a second time. Without the pin, a name that answers publicly
// during the check and privately during the connection (DNS rebinding) would defeat
// it. TLS still verifies against the hostname, so pinning does not weaken the
// certificate check. Redirects are never followed: the 3xx is returned as-is, so a
// caller cannot be steered to an address that was never validated.
export async function pinnedFetch(raw: string, init: PinnedRequestInit = {}): Promise<Response> {
  const { url, pin } = await vet(raw, init);
  init.signal?.throwIfAborted();
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
        let bytes = 0;
        const complete = () => {
          const status = res.statusCode ?? 502;
          if (status < 200 || status > 599) {
            reject(new Error('response has an invalid HTTP status'));
            return;
          }
          const empty = status === 204 || status === 205 || status === 304;
          resolve(
            new Response(empty ? null : Buffer.concat(chunks), {
              status,
              headers: Object.entries(res.headers).flatMap(([k, v]) =>
                v == null ? [] : [[k, Array.isArray(v) ? v.join(', ') : v] as [string, string]],
              ),
            }),
          );
        };
        res.on('data', (chunk: Buffer) => {
          if (init.maxBytes !== undefined && bytes + chunk.length > init.maxBytes) {
            if (init.truncateBody) {
              chunks.push(chunk.subarray(0, init.maxBytes - bytes));
              complete();
              res.destroy();
              req.destroy();
              return;
            }
            const error = new Error('response exceeds the byte limit');
            res.destroy(error);
            req.destroy(error);
            return;
          }
          bytes += chunk.length;
          chunks.push(chunk);
        });
        res.on('error', reject);
        res.on('end', complete);
      },
    );
    req.on('error', reject);
    const abort = () => req.destroy(new Error('request aborted'));
    init.signal?.addEventListener('abort', abort, { once: true });
    req.on('close', () => init.signal?.removeEventListener('abort', abort));
    if (init.signal?.aborted) abort();
    if (init.timeoutMs) {
      req.setTimeout(init.timeoutMs, () => req.destroy(new Error('request timed out')));
    }
    req.end(init.body);
  });
}
