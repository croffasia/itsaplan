import type { Integration } from '../../types';
import { giteaListIssues } from './list-issues';
import { giteaCreateIssue } from './create-issue';
import { giteaUpdateIssue } from './update-issue';
import { giteaCommentIssue } from './comment-issue';
import { giteaListPullRequests } from './list-pull-requests';
import { giteaGetPullRequest } from './get-pull-request';
import { giteaListPullRequestFiles } from './list-pull-request-files';
import { giteaReviewPullRequest } from './review-pull-request';
import { giteaListReviewComments } from './list-review-comments';
import { giteaReplyReviewComment } from './reply-review-comment';
import { giteaResolveReviewComment } from './resolve-review-comment';
import { giteaMergePullRequest } from './merge-pull-request';
import { giteaIcon } from './icon';
import { verifyGitea } from './verify';

// Gitea and Forgejo, which serves the same API: the issues and pull requests of a
// repository an agent can read and act on. One credential is one personal access token
// against one instance. Forgejo is in the label so that searching for it finds these tools.
export const gitea: Integration = {
  key: 'gitea',
  label: 'Gitea / Forgejo',
  description:
    'Lists, creates and updates issues, and reviews and merges pull requests on a Gitea or Forgejo server.',
  credentialSchema: [
    {
      key: 'baseUrl',
      label: 'Instance URL',
      type: 'url',
      required: true,
      placeholder: 'https://git.example.com',
      help: 'Base URL of your Gitea or Forgejo instance.',
    },
    {
      key: 'token',
      label: 'Access token',
      type: 'secret',
      required: true,
      help: 'Personal access token with read and write access to issue and repository (Settings, Applications). It reaches only the repositories the account can access.',
    },
  ],
  icon: giteaIcon,
  website: 'https://about.gitea.com',
  verify: verifyGitea,
  tools: [
    giteaListIssues,
    giteaCreateIssue,
    giteaUpdateIssue,
    giteaCommentIssue,
    giteaListPullRequests,
    giteaGetPullRequest,
    giteaListPullRequestFiles,
    giteaReviewPullRequest,
    giteaListReviewComments,
    giteaReplyReviewComment,
    giteaResolveReviewComment,
    giteaMergePullRequest,
  ],
};
