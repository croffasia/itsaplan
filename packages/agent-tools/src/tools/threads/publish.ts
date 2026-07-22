import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { threadsToken, publishMedia, REPLY_CONTROL } from './client';

// Publish a new post to Threads. No media -> text post; one image or video -> single
// media post; two or more -> carousel. Media must be PUBLICLY reachable URLs (images
// JPEG/PNG, video MP4/MOV). Handles container creation, processing, and publishing.
export const threadsPublish: CustomToolEntry = {
  key: 'threads_publish',
  label: 'Threads Publish Post',
  scopes: ['threads_basic', 'threads_content_publish'],
  description:
    'Publish a new post to Threads. Provide text and/or public media URLs (images JPEG/PNG, video MP4/MOV). 0 media -> text post, 1 -> image/video, 2+ -> carousel. Returns the published media id and permalink.',
  inputSchema: z.object({
    text: z
      .string()
      .optional()
      .describe('Post text (up to 500 characters). Required when no media is given.'),
    imageUrls: z
      .array(z.string())
      .optional()
      .describe('Public image URLs. Combined with videoUrl: 2+ total media becomes a carousel.'),
    videoUrl: z.string().optional().describe('A single public video URL.'),
    topicTag: z
      .string()
      .optional()
      .describe(
        'Topic tag, one per post (1-50 chars, no "." or "&", no leading "#"), e.g. "Open Source".',
      ),
    replyControl: z
      .enum(REPLY_CONTROL)
      .optional()
      .describe('Who may reply to this post. Default everyone.'),
    quotePostId: z.string().optional().describe('Media id of a post to quote.'),
    linkAttachment: z
      .string()
      .optional()
      .describe('A URL to attach as a link preview (text posts only).'),
    locationId: z
      .string()
      .optional()
      .describe('Threads location id to tag (from threads_location_search).'),
    altText: z
      .string()
      .optional()
      .describe('Accessibility alt text for a single image/video post.'),
    allowlistedCountryCodes: z
      .string()
      .optional()
      .describe('Comma-separated ISO country codes the post is limited to.'),
  }),
  execute: async (credential, input) => {
    const token = threadsToken(credential);
    const extra: Record<string, unknown> = {
      topic_tag: input.topicTag || undefined,
      reply_control: input.replyControl || undefined,
      quote_post_id: input.quotePostId || undefined,
      link_attachment: input.linkAttachment || undefined,
      location_id: input.locationId || undefined,
      alt_text: input.altText || undefined,
      allowlisted_country_codes: input.allowlistedCountryCodes || undefined,
    };
    return publishMedia(token, {
      text: input.text as string | undefined,
      imageUrls: input.imageUrls as string[] | undefined,
      videoUrl: input.videoUrl as string | undefined,
      extra,
    });
  },
};
