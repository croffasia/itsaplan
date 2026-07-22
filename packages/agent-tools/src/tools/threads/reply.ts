import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { threadsToken, publishMedia, REPLY_CONTROL } from './client';

// Reply to an existing Threads post (or reply). Same media rules as a top-level post:
// text and/or public media URLs. Returns the published reply's media id and permalink.
export const threadsReply: CustomToolEntry = {
  key: 'threads_reply',
  label: 'Threads Reply',
  scopes: ['threads_basic', 'threads_content_publish'],
  description:
    "Reply to an existing Threads post or reply. Provide replyToId and text and/or public media URLs. Returns the published reply's media id and permalink.",
  inputSchema: z.object({
    replyToId: z.string().min(1).describe('Media id of the post or reply to reply to.'),
    text: z
      .string()
      .optional()
      .describe('Reply text (up to 500 characters). Required when no media is given.'),
    imageUrls: z
      .array(z.string())
      .optional()
      .describe('Public image URLs. 2+ total media becomes a carousel.'),
    videoUrl: z.string().optional().describe('A single public video URL.'),
    topicTag: z
      .string()
      .optional()
      .describe('Topic tag (1-50 chars, no "." or "&", no leading "#").'),
    replyControl: z.enum(REPLY_CONTROL).optional().describe('Who may reply to this reply.'),
  }),
  execute: async (credential, input) => {
    const token = threadsToken(credential);
    const extra: Record<string, unknown> = {
      reply_to_id: String(input.replyToId),
      topic_tag: input.topicTag || undefined,
      reply_control: input.replyControl || undefined,
    };
    return publishMedia(token, {
      text: input.text as string | undefined,
      imageUrls: input.imageUrls as string[] | undefined,
      videoUrl: input.videoUrl as string | undefined,
      extra,
    });
  },
};
