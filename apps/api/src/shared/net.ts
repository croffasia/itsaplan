import {
  assertPublicHost as assertPublicHostname,
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

export function assertPublicHost(host: string, label?: string): Promise<void> {
  return as400(() => assertPublicHostname(host, label));
}

export function pinnedFetch(raw: string, init?: PinnedRequestInit): Promise<Response> {
  return as400(() => pinnedFetchUrl(raw, init));
}
