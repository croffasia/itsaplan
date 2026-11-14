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
import { threadsIcon } from './icon';
import { verifyThreads } from './verify';

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
        'A long-lived Threads user access token (Meta App -> Use cases -> Threads -> Generate access token).\n\n' +
        'Scopes gate individual tools:\n' +
        '- `threads_basic`: read\n' +
        '- `threads_content_publish`: post and reply\n' +
        '- `threads_delete`: delete\n' +
        '- `threads_read_replies`: read replies and conversations\n' +
        '- `threads_manage_replies`: hide and approve replies\n' +
        '- `threads_manage_insights`: insights\n' +
        '- `threads_keyword_search`: keyword search\n' +
        '- `threads_location_tagging`: location search',
    },
  ],
  icon: threadsIcon,
  website: 'https://www.threads.com',
  verify: verifyThreads,
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
