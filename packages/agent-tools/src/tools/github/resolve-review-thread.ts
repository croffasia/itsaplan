import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { githubGraphql } from './client';

type Payload = { thread: { id: string; isResolved: boolean } | null } | null;

export const githubResolveReviewThread: CustomToolEntry = {
  key: 'github_resolve_review_thread',
  group: 'Pull requests',
  label: 'GitHub Resolve Review Thread',
  description:
    'Resolve a review thread of a GitHub pull request, or reopen it with resolved false. Take the thread id from github_list_review_threads.',
  inputSchema: z.object({
    thread: z.string().min(1).describe('Thread id from github_list_review_threads.'),
    resolved: z.boolean().optional().describe('false reopens a resolved thread (default true).'),
  }),
  execute: async (credential, input) => {
    const [name, type] =
      input.resolved === false
        ? ['unresolveReviewThread', 'UnresolveReviewThreadInput']
        : ['resolveReviewThread', 'ResolveReviewThreadInput'];
    const data = await githubGraphql<Record<string, Payload>>(
      credential,
      `mutation($input: ${type}!) { ${name}(input: $input) { thread { id isResolved } } }`,
      { input: { threadId: String(input.thread) } },
    );
    const thread = data[name]?.thread;
    return { id: thread?.id ?? String(input.thread), resolved: thread?.isResolved ?? null };
  },
};
