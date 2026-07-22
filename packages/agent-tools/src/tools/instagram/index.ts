import type { Integration } from '../../types';
import {
  instagramGetAccount,
  instagramListMedia,
  instagramListStories,
  instagramListTaggedMedia,
  instagramListLiveMedia,
  instagramContentPublishingLimit,
  instagramRecentlySearchedHashtags,
} from './account';
import { instagramBusinessDiscovery } from './discovery';
import {
  instagramGetMedia,
  instagramMediaChildren,
  instagramUpdateMedia,
  instagramDeleteMedia,
} from './media';
import {
  instagramListComments,
  instagramCreateComment,
  instagramGetComment,
  instagramListCommentReplies,
  instagramReplyToComment,
  instagramHideComment,
  instagramDeleteComment,
} from './comments';
import {
  instagramReplyToMention,
  instagramGetMentionedComment,
  instagramGetMentionedMedia,
} from './mentions';
import {
  instagramHashtagSearch,
  instagramHashtagTopMedia,
  instagramHashtagRecentMedia,
} from './hashtags';
import { instagramAccountInsights, instagramMediaInsights } from './insights';
import {
  instagramCreateMediaContainer,
  instagramCreateCarousel,
  instagramContainerStatus,
  instagramPublishMedia,
  instagramPublishPost,
} from './publishing';

// Instagram Platform API (Instagram API with Facebook Login), served from the
// Facebook Graph API host. One credential is one Instagram Business/Creator
// account: a long-lived access token plus the account's IG User ID. Two accounts
// are two credentials.
export const instagram: Integration = {
  key: 'instagram',
  label: 'Instagram',
  credentialSchema: [
    {
      key: 'accessToken',
      label: 'Access token',
      type: 'secret',
      required: true,
      placeholder: 'EAAG...',
      help: 'A long-lived Instagram/Facebook access token with the Instagram Graph API permissions the tools you enable require (e.g. instagram_basic, instagram_content_publish, instagram_manage_comments, instagram_manage_insights).',
    },
    {
      key: 'igUserId',
      label: 'Instagram user id',
      type: 'string',
      required: true,
      placeholder: '17841400000000000',
      help: 'The IG User ID of the Business/Creator account this token belongs to.',
    },
  ],
  tools: [
    // Account
    instagramGetAccount,
    instagramListMedia,
    instagramListStories,
    instagramListTaggedMedia,
    instagramListLiveMedia,
    instagramContentPublishingLimit,
    instagramRecentlySearchedHashtags,
    // Discovery
    instagramBusinessDiscovery,
    // Media
    instagramGetMedia,
    instagramMediaChildren,
    instagramUpdateMedia,
    instagramDeleteMedia,
    // Comments
    instagramListComments,
    instagramCreateComment,
    instagramGetComment,
    instagramListCommentReplies,
    instagramReplyToComment,
    instagramHideComment,
    instagramDeleteComment,
    // Mentions
    instagramReplyToMention,
    instagramGetMentionedComment,
    instagramGetMentionedMedia,
    // Hashtags
    instagramHashtagSearch,
    instagramHashtagTopMedia,
    instagramHashtagRecentMedia,
    // Insights
    instagramAccountInsights,
    instagramMediaInsights,
    // Publishing
    instagramCreateMediaContainer,
    instagramCreateCarousel,
    instagramContainerStatus,
    instagramPublishMedia,
    instagramPublishPost,
  ],
};
