import { t } from 'elysia';

export const mentionCandidatesQuery = t.Object({
  place: t.Union([t.Literal('comment'), t.Literal('text')], {
    description: 'Where the mention is written: a comment, or the text itself.',
  }),
});

export const issueMentionParams = t.Object({ projectKey: t.String() });

export const documentMentionParams = t.Object({
  projectKey: t.String(),
  documentId: t.Numeric(),
});

export const MentionCandidateResponse = t.Object({
  userId: t.String(),
  name: t.String(),
  username: t.String(),
  kind: t.Union([t.Literal('member'), t.Literal('agent')]),
});
