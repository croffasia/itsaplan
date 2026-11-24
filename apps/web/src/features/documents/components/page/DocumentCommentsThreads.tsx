import type { Editor } from '@tiptap/react';
import type { DocumentComment } from '@/lib/api/endpoints/documents';
import { useShell } from '@/context/shellContext';
import { useSession } from '@/lib/auth-client';
import type { useDocumentComments } from '../../hooks/useDocumentComments';
import { highlightCommentMark } from '../../hooks/useDocumentCommentMarks';
import { jumpToComment } from '../../utils/documentComments';
import DocumentCommentThread from './DocumentCommentThread';

type DocumentCommentWrites = ReturnType<typeof useDocumentComments>;

// The threads of one tab of the comments panel. `comments` holds every comment of the
// page, so each thread finds its replies.
export default function DocumentCommentsThreads({
  editor,
  projectKey,
  comments,
  threads,
  activeId,
  activeThreadId,
  canComment,
  reply,
  update,
  onActiveChange,
  onReopen,
}: {
  editor: Editor | null;
  projectKey: string;
  comments: DocumentComment[];
  threads: DocumentComment[];
  activeId: string | null;
  activeThreadId: string | null;
  canComment: boolean;
  reply: DocumentCommentWrites['reply'];
  update: DocumentCommentWrites['update'];
  onActiveChange: (id: string | null) => void;
  onReopen: (id: string) => void;
}) {
  const { data: session } = useSession();
  const { project } = useShell();
  const images = new Map(project?.assignees.map((person) => [person.userId, person.image]));
  const busy = reply.isPending || update.isPending;

  return threads.map((comment) => (
    <DocumentCommentThread
      key={comment.id}
      projectKey={projectKey}
      comment={comment}
      replies={comments.filter((item) => item.parentId === comment.id)}
      images={images}
      userId={session?.user.id ?? null}
      active={comment.id === activeThreadId}
      canComment={canComment}
      busy={busy}
      onActivate={() => {
        onActiveChange(comment.id);
        jumpToComment(editor, comment);
      }}
      onHover={(hovered) => highlightCommentMark(editor, hovered ? comment.id : activeId)}
      onResolve={() => {
        if (comment.id === activeId) onActiveChange(null);
        update.mutate({ id: comment.id, input: { resolved: true } });
      }}
      onReopen={() => {
        onReopen(comment.id);
        update.mutate({ id: comment.id, input: { resolved: false } });
      }}
      onReply={async (body) => {
        await reply.mutateAsync({ parentId: comment.id, body });
        onActiveChange(comment.id);
      }}
      onEdit={async (id, body) => {
        await update.mutateAsync({ id, input: { body } });
      }}
    />
  ));
}
