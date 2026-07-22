import type { GraphApiResponse, ToolConfig } from '../../types';
import { sleep } from '../time';

// Threads (Meta) Graph API client. All calls go to graph.threads.net and carry the
// integration credential's long-lived user access token as the access_token query
// param. User-scoped endpoints are addressed as "me", which the API resolves to the
// token owner, so no numeric user id needs to be configured.
const THREADS_BASE = 'https://graph.threads.net/v1.0';

// The access token from the integration credential.
export function threadsToken(credential: ToolConfig): string {
  const token = credential.accessToken ? String(credential.accessToken) : '';
  if (!token) throw new Error('No Threads access token configured.');
  return token;
}

// Send a request to the Threads API. Params (including access_token) go in the query
// string, which the Threads API expects for reads and writes alike. Throws a useful
// message when the API reports an error, so a tool surfaces it to the model.
export async function threadsRequest(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  params: Record<string, unknown>,
): Promise<GraphApiResponse> {
  const url = new URL(`${THREADS_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { method });
  const raw = await res.text();
  let body: GraphApiResponse = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok || body.error) {
    const msg = body.error?.message || body.error?.error_user_msg || `HTTP ${res.status}`;
    throw new Error(`Threads API error: ${msg}`);
  }
  return body;
}

// Poll a media container until it is FINISHED (ready to publish) or fail on
// ERROR/EXPIRED. Image and video containers need processing time before they can be
// published. Gives up after ~60s: a container still processing lets the caller try to
// publish anyway, but when every read failed the last error is thrown instead, so a
// bad token or id surfaces rather than being swallowed.
export async function waitUntilFinished(containerId: string, token: string): Promise<void> {
  let lastError: unknown = null;
  for (let i = 0; i < 12; i++) {
    await sleep(5000);
    const st = await threadsRequest('GET', containerId, {
      fields: 'status,error_message',
      access_token: token,
    }).catch((err: unknown) => {
      lastError = err;
      return null;
    });
    if (!st) continue; // read error — keep polling in case it is transient
    lastError = null;
    if (st.status === 'FINISHED' || st.status === 'PUBLISHED') return;
    if (st.status === 'ERROR' || st.status === 'EXPIRED') {
      throw new Error(
        `Threads container ${String(st.status)}: ${String(st.error_message ?? 'unknown error')}`,
      );
    }
  }
  if (lastError) throw lastError;
}

// Create a media container and return its id.
export async function createContainer(
  token: string,
  params: Record<string, unknown>,
): Promise<string> {
  const body = await threadsRequest('POST', 'me/threads', { ...params, access_token: token });
  if (!body.id) throw new Error('Threads: container creation returned no id.');
  return String(body.id);
}

// Publish a container and return the published media id.
export async function publishContainer(token: string, creationId: string): Promise<string> {
  const body = await threadsRequest('POST', 'me/threads_publish', {
    creation_id: creationId,
    access_token: token,
  });
  if (!body.id) throw new Error('Threads: publish returned no media id.');
  return String(body.id);
}

// Best-effort permalink for a published media id.
export async function permalinkOf(token: string, mediaId: string): Promise<string | null> {
  const info = await threadsRequest('GET', mediaId, {
    fields: 'permalink',
    access_token: token,
  }).catch(() => null);
  return (info?.permalink as string | undefined) ?? null;
}

// One item of a post's media: an image or a video, by its public URL.
type MediaItem = { type: 'IMAGE' | 'VIDEO'; url: string };

// Create the media container(s) for a post and publish them. No media -> TEXT; one
// image/video -> IMAGE/VIDEO; two or more -> CAROUSEL (one item container per media,
// then a parent holding them). `extra` carries the endpoint params shared by posts and
// replies (topic_tag, reply_control, reply_to_id, quote_post_id, link_attachment,
// location_id, alt_text, allowlisted_country_codes); it belongs on the parent
// container, never on carousel item containers. Returns the media id and permalink.
export async function publishMedia(
  token: string,
  opts: {
    text?: string | null;
    imageUrls?: string[] | null;
    videoUrl?: string | null;
    extra?: Record<string, unknown>;
  },
): Promise<{ id: string; permalink: string | null }> {
  const media: MediaItem[] = [
    ...(opts.imageUrls ?? []).filter(Boolean).map((url) => ({ type: 'IMAGE' as const, url })),
    ...(opts.videoUrl ? [{ type: 'VIDEO' as const, url: opts.videoUrl }] : []),
  ];
  const extra = opts.extra ?? {};
  const urlKey = (m: MediaItem) => (m.type === 'IMAGE' ? 'image_url' : 'video_url');

  let creationId: string;
  if (media.length >= 2) {
    const children: string[] = [];
    for (const m of media) {
      const itemId = await createContainer(token, {
        media_type: m.type,
        [urlKey(m)]: m.url,
        is_carousel_item: true,
      });
      await waitUntilFinished(itemId, token);
      children.push(itemId);
    }
    creationId = await createContainer(token, {
      media_type: 'CAROUSEL',
      children: children.join(','),
      text: opts.text ?? undefined,
      ...extra,
    });
    await waitUntilFinished(creationId, token);
  } else if (media.length === 1) {
    const m = media[0];
    creationId = await createContainer(token, {
      media_type: m.type,
      [urlKey(m)]: m.url,
      text: opts.text ?? undefined,
      ...extra,
    });
    await waitUntilFinished(creationId, token);
  } else {
    creationId = await createContainer(token, {
      media_type: 'TEXT',
      text: opts.text ?? undefined,
      ...extra,
    });
  }

  const mediaId = await publishContainer(token, creationId);
  return { id: mediaId, permalink: await permalinkOf(token, mediaId) };
}

// Default field set for reading a media object (post or reply). Callers may override
// with their own `fields` string.
export const MEDIA_FIELDS =
  'id,media_product_type,media_type,permalink,username,text,timestamp,shortcode,' +
  'thumbnail_url,media_url,is_quote_post,has_replies,reply_audience,alt_text,' +
  'link_attachment_url,gif_url,topic_tag,children';

// Default field set for a reply object: the media fields plus reply-specific ones.
export const REPLY_FIELDS = MEDIA_FIELDS + ',hide_status,is_reply,replied_to,root_post';

// Default field set for a pending reply. Kept to the fields the pending-replies node
// documents (which include reply_approval_status), so the default request does not ask
// for a field the node rejects.
export const PENDING_REPLY_FIELDS =
  'id,text,timestamp,media_product_type,media_type,shortcode,' +
  'has_replies,is_reply,hide_status,reply_approval_status';

// Values Threads accepts for who may reply to a post.
export const REPLY_CONTROL = [
  'everyone',
  'accounts_you_follow',
  'mentioned_only',
  'parent_post_author_only',
  'followers_only',
] as const;
