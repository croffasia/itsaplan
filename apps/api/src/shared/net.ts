import {
  assertPublicHttpUrl as assertPublicUrl,
  pinnedFetch as pinnedFetchUrl,
  UrlNotAllowedError,
  type PinnedRequestInit,
} from '@repo/net';
import { HttpError } from './lib';

function as400<T>(run: () => Promise<T>): Promise<T> {
  return run().catch((err: unknown) => {
    if (err instanceof UrlNotAllowedError) throw new HttpError(400, err.message);
    throw err;
  });
}

// The shared SSRF guards, with their rejection turned into the API's 400.
export function assertPublicHttpUrl(raw: string): Promise<URL> {
  return as400(() => assertPublicUrl(raw));
}

export function pinnedFetch(raw: string, init?: PinnedRequestInit): Promise<Response> {
  return as400(() => pinnedFetchUrl(raw, init));
}
