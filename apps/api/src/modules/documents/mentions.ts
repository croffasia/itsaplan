import { parseMentionHandles, resolveMentionHandles } from '#shared/mentions';
import { mentionReach, queueMentionRuns } from '#modules/mentions/service';
import { notifyDocumentMentions } from '#modules/notifications/service';

// Mentions in a document. Who a mention reaches is decided by mentionReach; here the
// handles are read from the document and its comments, and the reach is notified or
// given a run.

// The handles the text of a document mentions, lowercased, in first-seen order. The
// editor writes a mention as a node of its own, so the stored tree is read where there
// is one: a handle typed without picking it from the menu stays text, and an autosave
// made while it is typed reaches nobody. A page written as markdown alone, over the
// API, is read from the markdown.
export function documentMentionHandles(document: {
  content: string;
  contentJson: Record<string, unknown> | null;
}): string[] {
  if (!document.contentJson) return parseMentionHandles(document.content);
  const handles = new Set<string>();
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const { type, attrs, content } = node as {
      type?: unknown;
      attrs?: { username?: unknown };
      content?: unknown;
    };
    if (type === 'mention' && typeof attrs?.username === 'string')
      handles.add(attrs.username.toLowerCase());
    if (Array.isArray(content)) content.forEach(visit);
  };
  visit(document.contentJson);
  return [...handles];
}

// Notifies the members a write of the document's text newly named.
export async function fanOutTextMentions(input: {
  projectId: number;
  documentId: number;
  before: string[];
  after: string[];
  actorUserId: string;
}): Promise<void> {
  const had = new Set(input.before);
  const added = input.after.filter((handle) => !had.has(handle));
  if (added.length === 0) return;
  const { memberIds } = await mentionReach(
    input.projectId,
    input.actorUserId,
    { on: 'document', documentId: input.documentId, place: 'text' },
    await resolveMentionHandles(input.projectId, added),
  );
  await notifyDocumentMentions({
    projectId: input.projectId,
    documentId: input.documentId,
    documentCommentId: null,
    actorUserId: input.actorUserId,
    memberIds,
  });
}

// Fans out the handles of a comment: all of a new comment's, and only the ones an edit
// added to an existing one. A reply also reaches the author of the comment it answers,
// so answering an agent does not have to tag it again.
export async function fanOutCommentMentions(input: {
  projectId: number;
  documentId: number;
  comment: { id: string; body: string; authorId: string };
  handles: string[];
  answeredUserId?: string | null;
}): Promise<void> {
  const { projectId, documentId, comment } = input;
  if (input.handles.length === 0 && !input.answeredUserId) return;
  const mentioned = await resolveMentionHandles(projectId, input.handles);
  const reach = await mentionReach(
    projectId,
    comment.authorId,
    { on: 'document', documentId, place: 'comment' },
    {
      memberIds: mentioned.memberIds,
      agentUserIds: input.answeredUserId
        ? [...mentioned.agentUserIds, input.answeredUserId]
        : mentioned.agentUserIds,
    },
  );
  await notifyDocumentMentions({
    projectId,
    documentId,
    documentCommentId: comment.id,
    actorUserId: comment.authorId,
    memberIds: reach.memberIds,
  });
  await queueMentionRuns({
    projectId,
    actorUserId: comment.authorId,
    agents: reach.agents,
    prompt: comment.body,
    source: { documentId, sourceDocumentCommentId: comment.id },
  });
}
