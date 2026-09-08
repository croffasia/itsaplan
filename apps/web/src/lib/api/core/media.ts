// Points a relative media path (a stored avatar or attachment URL) at the web
// origin's media route (app/media), which streams it from the API. Leaves an
// absolute URL — an embed stored before this, or an external image — untouched.
export function mediaUrl(url: string): string {
  return url.startsWith('http') ? url : `/media${url}`;
}
