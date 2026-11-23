import type { Integration } from '../../types';
import { gitlabListIssues } from './list-issues';
import { gitlabCreateIssue } from './create-issue';
import { gitlabUpdateIssue } from './update-issue';
import { gitlabCommentIssue } from './comment-issue';
import { gitlabListMergeRequests } from './list-merge-requests';
import { gitlabGetMergeRequest } from './get-merge-request';
import { gitlabListMergeRequestFiles } from './list-merge-request-files';
import { gitlabReviewMergeRequest } from './review-merge-request';
import { gitlabListMergeRequestThreads } from './list-merge-request-threads';
import { gitlabReplyMergeRequestThread } from './reply-merge-request-thread';
import { gitlabResolveMergeRequestThread } from './resolve-merge-request-thread';
import { gitlabAcceptMergeRequest } from './accept-merge-request';
import { gitlabCommentMergeRequest } from './comment-merge-request';
import { gitlabIcon } from './icon';
import { verifyGitlab } from './verify';

// GitLab: the issues and merge requests of a project an agent can read and act on. One
// credential is one access token on gitlab.com, on a GitLab Self-Managed instance, or on
// GitLab Dedicated.
export const gitlab: Integration = {
  key: 'gitlab',
  label: 'GitLab',
  description:
    'Lists, creates and updates issues, and reviews and merges merge requests in GitLab projects.',
  credentialSchema: [
    {
      key: 'baseUrl',
      label: 'Instance URL',
      type: 'url',
      required: false,
      placeholder: 'https://gitlab.com',
      help: 'Leave empty for gitlab.com. For GitLab Self-Managed or GitLab Dedicated, the address of your instance.',
    },
    {
      key: 'token',
      label: 'Access token',
      type: 'secret',
      required: true,
      help: 'Personal, project or group access token with the api scope (Edit profile, Access, Personal access tokens). A fine-grained token needs the Work Item resource with the Read, Create and Update permissions, and the Merge Request resource with Read, Create, Update, Approve and Merge. It reaches only the projects the account can access.',
    },
  ],
  icon: gitlabIcon,
  website: 'https://gitlab.com',
  verify: verifyGitlab,
  tools: [
    gitlabListIssues,
    gitlabCreateIssue,
    gitlabUpdateIssue,
    gitlabCommentIssue,
    gitlabListMergeRequests,
    gitlabGetMergeRequest,
    gitlabListMergeRequestFiles,
    gitlabReviewMergeRequest,
    gitlabListMergeRequestThreads,
    gitlabReplyMergeRequestThread,
    gitlabResolveMergeRequestThread,
    gitlabAcceptMergeRequest,
    gitlabCommentMergeRequest,
  ],
};
