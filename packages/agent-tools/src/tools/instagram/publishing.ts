import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { creds, igRequest, waitForContainer } from './client';

const userTag = z.object({
  username: z.string().describe('Public Instagram account to tag on this photo.'),
  x: z.number().describe('Horizontal tag position, 0-1 (photos only).'),
  y: z.number().describe('Vertical tag position, 0-1 (photos only).'),
});

// Creates a single media container. This is the low-level first step of
// publishing; feed the returned container id to instagram_publish_media (or list
// several as carousel children). image_url/video_url must be a PUBLIC URL Meta can
// fetch.
export const instagramCreateMediaContainer: CustomToolEntry = {
  key: 'instagram_create_media_container',
  scopes: ['instagram_basic', 'instagram_content_publish'],
  label: 'Instagram Create Media Container',
  description:
    'Create a media container (step 1 of publishing). Returns a container id to publish with instagram_publish_media, or to use as a carousel child. Provide a PUBLIC imageUrl or videoUrl. Set mediaType for REELS/STORIES/VIDEO; leave empty for a single image.',
  inputSchema: z.object({
    mediaType: z
      .enum(['IMAGE', 'VIDEO', 'REELS', 'STORIES', 'CAROUSEL'])
      .optional()
      .describe(
        'Container type. Omit for a single image. CAROUSEL is created by instagram_create_carousel instead.',
      ),
    imageUrl: z.string().optional().describe('Public image URL (for image containers).'),
    videoUrl: z
      .string()
      .optional()
      .describe('Public video URL (for VIDEO/REELS/STORIES containers).'),
    caption: z
      .string()
      .optional()
      .describe('Post caption. Omit for carousel children (the caption lives on the parent).'),
    coverUrl: z.string().optional().describe('Public cover image URL for a reel.'),
    thumbOffset: z
      .number()
      .optional()
      .describe('Milliseconds into the video to grab the thumbnail from.'),
    altText: z.string().optional().describe('Accessibility alt text (images only).'),
    locationId: z.string().optional().describe('A Facebook Page id to tag as the post location.'),
    userTags: z
      .array(userTag)
      .optional()
      .describe('Accounts to tag on a photo (photos only, never the carousel parent).'),
    isCarouselItem: z
      .boolean()
      .optional()
      .describe('Set true when this container will be a child of a carousel.'),
    shareToFeed: z
      .boolean()
      .optional()
      .describe(
        'For REELS: also show the reel in the main feed (true) or only under the Reels tab (false).',
      ),
    collaborators: z
      .string()
      .optional()
      .describe('Comma-separated usernames to invite as collaborators on the post.'),
    isAiGenerated: z.boolean().optional().describe('Disclose that the content is AI-generated.'),
  }),
  execute: async (credential, input) => {
    const { token, igUserId } = creds(credential);
    return igRequest(token, 'POST', `${igUserId}/media`, {
      media_type: input.mediaType,
      image_url: input.imageUrl,
      video_url: input.videoUrl,
      caption: input.caption,
      cover_url: input.coverUrl,
      thumb_offset: input.thumbOffset,
      alt_text: input.altText,
      location_id: input.locationId,
      user_tags:
        Array.isArray(input.userTags) && input.userTags.length
          ? JSON.stringify(input.userTags)
          : undefined,
      is_carousel_item: input.isCarouselItem ? 'true' : undefined,
      share_to_feed: input.shareToFeed == null ? undefined : input.shareToFeed ? 'true' : 'false',
      collaborators: input.collaborators,
      is_ai_generated: input.isAiGenerated ? 'true' : undefined,
    });
  },
};

// Creates a carousel parent container from previously created child containers.
export const instagramCreateCarousel: CustomToolEntry = {
  key: 'instagram_create_carousel',
  scopes: ['instagram_basic', 'instagram_content_publish'],
  label: 'Instagram Create Carousel Container',
  description:
    'Create a CAROUSEL parent container (2-10 items) from child container ids made with instagram_create_media_container (each with isCarouselItem set). Publish the returned id with instagram_publish_media.',
  inputSchema: z.object({
    childContainerIds: z
      .array(z.string())
      .min(2)
      .max(10)
      .describe('Child container ids, in display order (2-10).'),
    caption: z.string().optional().describe('Caption for the carousel (lives on the parent).'),
    locationId: z.string().optional().describe('A Facebook Page id to tag as the post location.'),
    collaborators: z
      .string()
      .optional()
      .describe('Comma-separated usernames to invite as collaborators.'),
  }),
  execute: async (credential, input) => {
    const { token, igUserId } = creds(credential);
    const children = (input.childContainerIds as string[]).map(String).join(',');
    return igRequest(token, 'POST', `${igUserId}/media`, {
      media_type: 'CAROUSEL',
      children,
      caption: input.caption,
      location_id: input.locationId,
      collaborators: input.collaborators,
    });
  },
};

// Reads a container's processing status.
export const instagramContainerStatus: CustomToolEntry = {
  key: 'instagram_container_status',
  scopes: ['instagram_basic', 'instagram_content_publish'],
  label: 'Instagram Container Status',
  description:
    "Read a media container's processing status. status_code is one of IN_PROGRESS, FINISHED, ERROR, EXPIRED, PUBLISHED. Only publish a FINISHED container.",
  inputSchema: z.object({
    containerId: z.string().describe('The container id returned by a create-container tool.'),
  }),
  execute: async (credential, input) => {
    const { token } = creds(credential);
    return igRequest(token, 'GET', String(input.containerId), {
      fields: 'status_code,status',
    });
  },
};

// Publishes a finished container.
export const instagramPublishMedia: CustomToolEntry = {
  key: 'instagram_publish_media',
  scopes: ['instagram_basic', 'instagram_content_publish'],
  label: 'Instagram Publish Media',
  description:
    'Publish a finished media container (step 2 of publishing). Returns the published media id. The container must be FINISHED; check with instagram_container_status if unsure.',
  inputSchema: z.object({
    containerId: z.string().describe('The container id to publish (its creation_id).'),
  }),
  execute: async (credential, input) => {
    const { token, igUserId } = creds(credential);
    return igRequest(token, 'POST', `${igUserId}/media_publish`, {
      creation_id: String(input.containerId),
    });
  },
};

const publishItem = z.object({
  imageUrl: z.string().describe('Public image URL.'),
  userTags: z.array(userTag).optional().describe('Accounts to tag on this photo.'),
});

// Convenience tool: create the container(s), wait for processing, and publish, in
// one call. 1 image -> single photo post, 2+ -> carousel (max 10). Text-only posts
// are not supported.
export const instagramPublishPost: CustomToolEntry = {
  key: 'instagram_publish_post',
  scopes: ['instagram_basic', 'instagram_content_publish'],
  label: 'Instagram Publish Post',
  description:
    'Publish a photo post in one call: creates the container(s), waits for processing, and publishes. Provide a caption and 1+ PUBLIC image URLs (1 -> single photo, 2+ -> carousel, max 10). Returns the media id and permalink.',
  inputSchema: z.object({
    caption: z.string().describe('Post caption.'),
    items: z
      .array(publishItem)
      .min(1)
      .max(10)
      .describe('1 item -> single photo, 2+ -> carousel (max 10).'),
  }),
  execute: async (credential, input) => {
    const { token, igUserId } = creds(credential);
    const items = (input.items as z.infer<typeof publishItem>[]).slice(0, 10);
    if (!items.length) throw new Error('Instagram: at least one image is required.');

    const tagsOf = (i: z.infer<typeof publishItem>) =>
      Array.isArray(i.userTags) && i.userTags.length ? JSON.stringify(i.userTags) : undefined;

    let creationId: string;
    if (items.length >= 2) {
      const children: string[] = [];
      for (const item of items) {
        const child = await igRequest(token, 'POST', `${igUserId}/media`, {
          image_url: item.imageUrl,
          is_carousel_item: 'true',
          user_tags: tagsOf(item),
        });
        if (!child.id) throw new Error('Instagram: carousel child creation returned no id.');
        await waitForContainer(child.id, token);
        children.push(child.id);
      }
      const parent = await igRequest(token, 'POST', `${igUserId}/media`, {
        media_type: 'CAROUSEL',
        children: children.join(','),
        caption: input.caption,
      });
      if (!parent.id) throw new Error('Instagram: carousel container creation returned no id.');
      creationId = parent.id;
    } else {
      const single = await igRequest(token, 'POST', `${igUserId}/media`, {
        image_url: items[0].imageUrl,
        caption: input.caption,
        user_tags: tagsOf(items[0]),
      });
      if (!single.id) throw new Error('Instagram: container creation returned no id.');
      creationId = single.id;
    }

    await waitForContainer(creationId, token);
    const published = await igRequest(token, 'POST', `${igUserId}/media_publish`, {
      creation_id: creationId,
    });
    if (!published.id) throw new Error('Instagram: publish returned no media id.');

    let permalink: string | null = null;
    try {
      const info = await igRequest(token, 'GET', published.id, { fields: 'permalink' });
      permalink = (info.permalink as string | undefined) ?? null;
    } catch {
      // Permalink is best-effort.
    }
    return { id: published.id, permalink };
  },
};
