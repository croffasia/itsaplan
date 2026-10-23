import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { githubGraphql, repoInput } from './client';

interface Category {
  id: string;
  name: string;
  slug: string;
}

// GitHub takes the repository and the category as node ids, so both are looked up
// first; a repository has at most 25 categories, all read at once.
export const githubCreateDiscussion: CustomToolEntry = {
  key: 'github_create_discussion',
  label: 'GitHub Create Discussion',
  description:
    'Start a discussion in a GitHub repository, in one of its discussion categories. The body is markdown. An unknown category is answered with the list of the categories the repository has. Returns the new discussion with its number, which the other GitHub discussion tools take.',
  inputSchema: z.object({
    ...repoInput,
    category: z.string().min(1).describe('Category name or slug, e.g. General or q-a.'),
    title: z.string().min(1).describe('Discussion title.'),
    body: z.string().min(1).describe('Discussion text, as markdown.'),
  }),
  execute: async (credential, input) => {
    const data = await githubGraphql<{
      repository: {
        id: string;
        hasDiscussionsEnabled: boolean;
        discussionCategories: { nodes: Category[] };
      } | null;
    }>(
      credential,
      `query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          id
          hasDiscussionsEnabled
          discussionCategories(first: 25) { nodes { id name slug } }
        }
      }`,
      { owner: String(input.owner), repo: String(input.repo) },
    );
    const repository = data.repository;
    if (!repository) throw new Error(`Repository ${input.owner}/${input.repo} not found.`);
    if (!repository.hasDiscussionsEnabled) {
      throw new Error('Discussions are disabled in this repository.');
    }
    const wanted = String(input.category).trim().toLowerCase();
    const categories = repository.discussionCategories.nodes;
    const category = categories.find(
      (c) => c.name.toLowerCase() === wanted || c.slug.toLowerCase() === wanted,
    );
    if (!category) {
      throw new Error(
        `No discussion category "${input.category}". The repository has: ${categories.map((c) => c.name).join(', ')}.`,
      );
    }
    const created = await githubGraphql<{
      createDiscussion: {
        discussion: { number: number; title: string; url: string; category: { name: string } };
      };
    }>(
      credential,
      `mutation($input: CreateDiscussionInput!) {
        createDiscussion(input: $input) {
          discussion { number title url category { name } }
        }
      }`,
      {
        input: {
          repositoryId: repository.id,
          categoryId: category.id,
          title: String(input.title),
          body: String(input.body),
        },
      },
    );
    const discussion = created.createDiscussion.discussion;
    return {
      number: discussion.number,
      title: discussion.title,
      category: discussion.category.name,
      url: discussion.url,
    };
  },
};
