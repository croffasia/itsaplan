import type { Integration } from '../../types';
import { giteaListIssues } from './list-issues';
import { giteaCreateIssue } from './create-issue';
import { giteaUpdateIssue } from './update-issue';
import { giteaCommentIssue } from './comment-issue';

// Gitea: the issues of a repository an agent can read and act on. One credential is
// one personal access token against one instance; a Forgejo instance works the same.
export const gitea: Integration = {
  key: 'gitea',
  label: 'Gitea',
  credentialSchema: [
    {
      key: 'baseUrl',
      label: 'Instance URL',
      type: 'url',
      required: true,
      placeholder: 'https://git.example.com',
      help: 'Base URL of your Gitea instance. A Forgejo instance works the same.',
    },
    {
      key: 'token',
      label: 'Access token',
      type: 'secret',
      required: true,
      help: 'Personal access token with repository read and write scope (Settings, Applications). It reaches only the repositories the account can access.',
    },
  ],
  tools: [giteaListIssues, giteaCreateIssue, giteaUpdateIssue, giteaCommentIssue],
};
