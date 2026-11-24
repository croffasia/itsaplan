import type { Integration } from '../../types';
import { githubListIssues } from './list-issues';
import { githubCreateIssue } from './create-issue';
import { githubUpdateIssue } from './update-issue';
import { githubCommentIssue } from './comment-issue';
import { githubListDiscussions } from './list-discussions';
import { githubGetDiscussion } from './get-discussion';
import { githubCreateDiscussion } from './create-discussion';
import { githubUpdateDiscussion } from './update-discussion';
import { githubCommentDiscussion } from './comment-discussion';
import { githubListPullRequests } from './list-pull-requests';
import { githubGetPullRequest } from './get-pull-request';
import { githubListPullRequestFiles } from './list-pull-request-files';
import { githubReviewPullRequest } from './review-pull-request';
import { githubListReviewThreads } from './list-review-threads';
import { githubReplyReviewThread } from './reply-review-thread';
import { githubResolveReviewThread } from './resolve-review-thread';
import { githubMergePullRequest } from './merge-pull-request';
import { githubIcon } from './icon';
import { verifyGithub } from './verify';

// GitHub: the issues, discussions and pull requests of a repository an agent can read
// and act on. One credential is one personal access token on github.com, on GHE.com, or
// on a GitHub Enterprise Server instance.
export const github: Integration = {
  key: 'github',
  label: 'GitHub',
  description:
    'Lists, creates and updates issues and discussions, and reviews and merges pull requests in GitHub repositories.',
  credentialSchema: [
    {
      key: 'baseUrl',
      label: 'Instance URL',
      type: 'url',
      required: false,
      placeholder: 'https://github.com',
      help: 'Leave empty for github.com. For GitHub Enterprise Server, the address of your instance; for GitHub Enterprise Cloud with data residency, your SUBDOMAIN.ghe.com address.',
    },
    {
      key: 'token',
      label: 'Access token',
      type: 'secret',
      required: true,
      help: 'Fine-grained personal access token with the Issues, Discussions and Pull requests repository permissions set to Read and write, and Contents set to Read, or to Read and write to merge pull requests, for the repositories the agent works in (Settings, Developer settings). A classic token needs the repo scope.',
    },
  ],
  icon: githubIcon,
  website: 'https://github.com',
  verify: verifyGithub,
  tools: [
    githubListIssues,
    githubCreateIssue,
    githubUpdateIssue,
    githubCommentIssue,
    githubListDiscussions,
    githubGetDiscussion,
    githubCreateDiscussion,
    githubUpdateDiscussion,
    githubCommentDiscussion,
    githubListPullRequests,
    githubGetPullRequest,
    githubListPullRequestFiles,
    githubReviewPullRequest,
    githubListReviewThreads,
    githubReplyReviewThread,
    githubResolveReviewThread,
    githubMergePullRequest,
  ],
};
