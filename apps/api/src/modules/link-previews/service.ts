import { assertPublicHttpUrl, pinnedFetch, UrlNotAllowedError } from '@repo/net';
import { HttpError } from '#shared/lib';
import { parseLinkMetadata, type LinkPreview } from './metadata';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

async function fetchPublic(
  url: URL,
  signal: AbortSignal,
  maxBytes: number,
  accept: string,
  truncateBody = false,
) {
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await pinnedFetch(url.href, {
      publicOnly: true,
      signal,
      maxBytes,
      truncateBody,
      headers: { Accept: accept, 'Accept-Encoding': 'identity' },
    });
    if (!REDIRECT_STATUSES.has(response.status)) return { response, url };
    const location = response.headers.get('location');
    if (!location || redirects === 3) return null;
    url = new URL(location, url);
  }
  return null;
}

function rasterType(bytes: Buffer): string | null {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP')
    return 'image/webp';
  return null;
}

async function fetchImage(raw: string, signal: AbortSignal): Promise<string | null> {
  try {
    const result = await fetchPublic(
      new URL(raw),
      signal,
      2 * 1024 * 1024,
      'image/png, image/jpeg, image/webp',
    );
    if (!result?.response.ok) return null;
    const bytes = Buffer.from(await result.response.arrayBuffer());
    const type = rasterType(bytes);
    return type ? `data:${type};base64,${bytes.toString('base64')}` : null;
  } catch {
    return null;
  }
}

export async function getLinkPreview(raw: string): Promise<LinkPreview> {
  const signal = AbortSignal.timeout(5000);
  let url: URL;
  try {
    url = await assertPublicHttpUrl(raw, { publicOnly: true, signal });
  } catch (error) {
    if (error instanceof UrlNotAllowedError) throw new HttpError(400, error.message);
    throw new HttpError(400, 'The link could not be resolved');
  }
  url.hash = '';
  const fallback: LinkPreview = {
    url: url.href,
    title: null,
    description: null,
    image: null,
    siteName: null,
  };
  try {
    const result = await fetchPublic(
      url,
      signal,
      512 * 1024,
      'text/html, application/xhtml+xml',
      true,
    );
    if (!result) return fallback;
    const { response } = result;
    const type = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    if (!response.ok || (type !== 'text/html' && type !== 'application/xhtml+xml')) return fallback;
    const preview = parseLinkMetadata(await response.text(), result.url.href);
    if (preview.image) preview.image = await fetchImage(preview.image, signal);
    return preview;
  } catch {
    return fallback;
  }
}
