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

// GitHub: the issues and discussions of a repository an agent can read and act on.
// One credential is one personal access token on github.com, on GHE.com, or on a
// GitHub Enterprise Server instance.
export const github: Integration = {
  key: 'github',
  label: 'GitHub',
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
      help: 'Fine-grained personal access token with the Issues and Discussions repository permissions set to Read and write, for the repositories the agent works in (Settings, Developer settings). A classic token needs the repo scope.',
    },
  ],
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
  ],
};
