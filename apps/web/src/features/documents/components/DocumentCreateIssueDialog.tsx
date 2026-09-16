import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Editor } from '@tiptap/react';
import type { SelectionBookmark } from '@tiptap/pm/state';
import { useTranslations } from 'next-intl';
import { type Issue, createIssue } from '@/lib/api/endpoints/issues';
import { listDocumentIssueLinks, linkDocumentIssue } from '@/lib/api/endpoints/documents';
import { useShell } from '@/context/shellContext';
import { qk } from '@/services/queryKeys';
import { documentPath, issuePath } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function DocumentCreateIssueDialog({
  editor,
  projectKey,
  documentId,
  quote,
  bookmark,
  onClose,
}: {
  editor: Editor;
  projectKey: string;
  documentId: number;
  quote: string;
  bookmark: { current: SelectionBookmark };
  onClose: () => void;
}) {
  const t = useTranslations('documents.workItem');
  const { project } = useShell();
  const qc = useQueryClient();
  const [title, setTitle] = useState(quote.slice(0, 255));
  const [columnId, setColumnId] = useState(project?.columns[0]?.id ?? 0);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState(false);
  const created = useRef<Issue | null>(null);
  const create = async () => {
    if (pending || !title.trim() || !columnId) return;
    setPending(true);
    setFailure(false);
    try {
      if (!created.current)
        created.current = await createIssue(projectKey, {
          title: title.trim(),
          columnId,
          description: `[${t('source')}](${new URL(documentPath(projectKey, documentId), window.location.origin).toString()})\n\n${quote}`,
        });
      const issue = created.current;
      const links = await listDocumentIssueLinks(projectKey, documentId);
      if (!links.some((link) => link.issueId === issue.id))
        await linkDocumentIssue(projectKey, documentId, issue.id);
      if (!editor.isDestroyed && editor.isEditable) {
        const selection = bookmark.current.resolve(editor.state.doc);
        const unchanged =
          editor.state.doc.textBetween(selection.from, selection.to, '\n') === quote;
        const from = unchanged ? selection.from : selection.to;
        editor
          .chain()
          .focus()
          .insertContentAt(
            { from, to: selection.to },
            {
              type: 'text',
              text: `${projectKey}-${issue.sequenceNumber}`,
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: issuePath(projectKey, issue.sequenceNumber),
                    class: 'document-issue-link',
                  },
                },
              ],
            },
          )
          .run();
      }
      void qc.invalidateQueries({ queryKey: qk.documentIssueLinks(projectKey, documentId) });
      void qc.invalidateQueries({ queryKey: qk.boardIssues(projectKey) });
      onClose();
    } catch {
      setFailure(true);
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('create')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <label className="grid gap-2 text-sm">
          {t('title')}
          <Input
            value={title}
            maxLength={255}
            onChange={(event) => setTitle(event.target.value)}
            disabled={pending || created.current !== null}
            autoFocus
          />
        </label>
        <label className="grid gap-2 text-sm">
          {t('status')}
          <select
            className="h-9 rounded-md border bg-background px-3"
            value={columnId}
            onChange={(event) => setColumnId(Number(event.target.value))}
            disabled={pending || created.current !== null}
          >
            {project?.columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.name}
              </option>
            ))}
          </select>
        </label>
        {failure && (
          <p role="alert" className="text-sm text-destructive">
            {created.current ? t('linkFailed') : t('failed')}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {t('cancel')}
          </Button>
          <Button onClick={() => void create()} disabled={pending || !title.trim() || !columnId}>
            {pending ? t('creating') : created.current ? t('retryLink') : t('create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
