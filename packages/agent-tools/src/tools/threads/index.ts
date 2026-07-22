import type { Integration } from '../../types';
import { threadsPublish } from './publish';
import { threadsReply } from './reply';
import { threadsDelete } from './delete';
import { threadsManageReply, threadsManagePendingReply } from './manage-reply';
import { threadsGetProfile } from './profile';
import { threadsPublishingLimit } from './publishing-limit';
import { threadsListPosts } from './list-posts';
import { threadsGetPost } from './get-post';
import {
  threadsListReplies,
  threadsGetConversation,
  threadsListUserReplies,
  threadsPendingReplies,
} from './replies';
import { threadsMediaInsights, threadsUserInsights } from './insights';
import { threadsKeywordSearch, threadsLocationSearch } from './search';

// Threads (Meta): publishing, reading, reply moderation, insights, and search over
// the Threads Graph API. One credential is one long-lived user access token; all
// user-scoped endpoints are addressed as "me".
export const threads: Integration = {
  key: 'threads',
  label: 'Threads',
  credentialSchema: [
    {
      key: 'accessToken',
      label: 'Access token',
      type: 'secret',
      required: true,
      placeholder: 'THQVJ...',
      help:
        'A long-lived Threads user access token (Meta App -> Use cases -> Threads -> Generate access token). ' +
        'Scopes gate individual tools: threads_basic (read), threads_content_publish (post/reply), ' +
        'threads_delete (delete), threads_read_replies (read replies/conversations), ' +
        'threads_manage_replies (hide/approve replies), threads_manage_insights (insights), ' +
        'threads_keyword_search (keyword search), threads_location_tagging (location search).',
    },
  ],
  tools: [
    threadsPublish,
    threadsReply,
    threadsDelete,
    threadsManageReply,
    threadsManagePendingReply,
    threadsGetProfile,
    threadsPublishingLimit,
    threadsListPosts,
    threadsGetPost,
    threadsListReplies,
    threadsGetConversation,
    threadsListUserReplies,
    threadsPendingReplies,
    threadsMediaInsights,
    threadsUserInsights,
    threadsKeywordSearch,
    threadsLocationSearch,
  ],
};
