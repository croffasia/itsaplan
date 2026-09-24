// Text stores an issue or initiative attachment as a path on the web, which serves it
// through its own /media route. An assistant reaches the api, not the web, so a tool
// result carries the api's public download url, computed on each call, and a call's
// arguments get the stored path back. Document assets need a session and keep theirs.

const ATTACHMENT_PATH = '/(?:initiative-)?attachments/[0-9a-f-]{36}/raw';

// A relative path starts a JSON string, a markdown link target or an HTML attribute;
// `\n` is a newline escaped inside a JSON string. Anything else before the slash is
// the host or path of an absolute url.
const RELATIVE = new RegExp(`(?<=^|[\\s"'(=]|\\\\[nrt])(?:/media)?(${ATTACHMENT_PATH})`, 'gi');

function apiOrigin(): string {
  return (process.env.API_URL ?? '').replace(/\/+$/, '');
}

export function withPublicAttachmentUrls(text: string): string {
  const origin = apiOrigin();
  return text.replace(RELATIVE, (_, path: string) => `${origin}${path}`);
}

export function withStoredAttachmentUrls(args: Record<string, unknown>): Record<string, unknown> {
  const origin = apiOrigin().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const absolute = new RegExp(`${origin}(${ATTACHMENT_PATH})`, 'gi');
  // A value that is only a url is an address the route fetches, not text it stores.
  const restore = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return URL.canParse(value) ? value : value.replace(absolute, '/media$1');
    }
    if (Array.isArray(value)) return value.map(restore);
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, restore(v)]));
    }
    return value;
  };
  return restore(args) as Record<string, unknown>;
}
