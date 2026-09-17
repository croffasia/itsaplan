import { request } from '../core/client';

export type LinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
};

export function getLinkPreview(url: string, signal: AbortSignal) {
  return request<LinkPreview>(`/link-previews?${new URLSearchParams({ url })}`, { signal });
}
