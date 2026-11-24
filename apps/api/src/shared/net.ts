import {
  assertPublicHttpUrl as assertPublicUrl,
  pinnedFetch as pinnedFetchUrl,
  UrlNotAllowedError,
  type PinnedRequestInit,
} from '@repo/net';
import { HttpError } from './lib';

export { ResponseTooLargeError } from '@repo/net';

function as400<T>(run: () => Promise<T>): Promise<T> {
  return run().catch((err: unknown) => {
    if (err instanceof UrlNotAllowedError) throw new HttpError(400, err.message);
    throw err;
  });
}

// The shared SSRF guards, with their rejection turned into the API's 400.
export function assertPublicHttpUrl(
  raw: string,
  policy?: Parameters<typeof assertPublicUrl>[1],
): Promise<URL> {
  return as400(() => assertPublicUrl(raw, policy));
}

export function pinnedFetch(raw: string, init?: PinnedRequestInit): Promise<Response> {
  return as400(() => pinnedFetchUrl(raw, init));
}
