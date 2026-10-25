import { Elysia, t } from 'elysia';
import { authContext } from '#shared/auth-context';
import { guards } from '#shared/guards';
import { requireUser } from '#shared/access';
import { commonErrors } from '#shared/responses';
import {
  MentionCandidateResponse,
  documentMentionParams,
  issueMentionParams,
  mentionCandidatesQuery,
} from './model';
import { listMentionCandidates } from './service';

export const mentionRoutes = new Elysia({ name: 'mentions', detail: { tags: ['Mentions'] } })
  .use(authContext)
  .use(guards)
  .get(
    '/projects/:projectKey/mention-candidates',
    ({ project, user, query }) =>
      listMentionCandidates(project.id, requireUser(user).id, { on: 'issue', place: query.place }),
    {
      permission: ['work_items', 'read'],
      params: issueMentionParams,
      query: mentionCandidatesQuery,
      response: { 200: t.Array(MentionCandidateResponse), ...commonErrors },
      detail: {
        summary: 'List who a mention on an issue reaches',
        description:
          'The members and agents an @username in a comment or in the text of an issue would reach, the caller left out.',
      },
    },
  )
  .get(
    '/projects/:projectKey/documents/:documentId/mention-candidates',
    ({ project, user, params, query }) =>
      listMentionCandidates(project.id, requireUser(user).id, {
        on: 'document',
        documentId: params.documentId,
        place: query.place,
      }),
    {
      permission: ['documents', 'read'],
      params: documentMentionParams,
      query: mentionCandidatesQuery,
      response: { 200: t.Array(MentionCandidateResponse), ...commonErrors },
      detail: {
        summary: 'List who a mention in a document reaches',
        description:
          'The members and agents an @username in a comment on a document or in its text would reach, the caller left out.',
      },
    },
  );
