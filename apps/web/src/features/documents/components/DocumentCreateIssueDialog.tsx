import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { SelectionBookmark } from '@tiptap/pm/state';
import { ChevronDown, CircleAlert, CircleDashed, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { colorDot } from '@/components/common/fields/colorDot';
import StatusSelect from '@/components/common/fields/StatusSelect';
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
import { useDocumentIssueFromSelection } from '../hooks/useDocumentIssueFromSelection';
import { useDocumentQuery } from '../services/documents.service';

const FIELD = 'flex min-w-0 flex-col gap-1.5 text-[13px] text-muted-foreground';
const BOX = 'flex h-9 min-w-0 items-center gap-2 rounded-md px-2.5 text-sm text-foreground';

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
  const t = useTranslations('documents');
  const { project } = useShell();
  const source = useDocumentQuery(projectKey, documentId).data;
  const [title, setTitle] = useState(quote.slice(0, 255));
  const [columnId, setColumnId] = useState(project?.columns[0]?.id ?? 0);
  const { create, pending, failure, created } = useDocumentIssueFromSelection({
    editor,
    projectKey,
    documentId,
    quote,
    bookmark,
    onDone: onClose,
  });
  const column = project?.columns.find((item) => item.id === columnId);
  const locked = pending || created;
  const state = (
    <>
      {column ? colorDot(column.color) : <CircleDashed className="size-3.5" />}
      <span className="min-w-0 truncate">{column?.name}</span>
    </>
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="gap-3 p-5 sm:max-w-120">
        <DialogHeader>
          <DialogTitle className="text-base">{t('workItem.create')}</DialogTitle>
          <DialogDescription>{t('workItem.description')}</DialogDescription>
        </DialogHeader>
        <blockquote
          className="max-h-22 overflow-y-auto rounded-md bg-warning/15 px-3 py-2 text-[13px] whitespace-pre-wrap text-muted-foreground"
          dir="auto"
        >
          {quote}
        </blockquote>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim() && columnId) void create(title.trim(), columnId);
          }}
        >
          <label className={FIELD}>
            {t('workItem.title')}
            <Input
              value={title}
              maxLength={255}
              required
              dir="auto"
              className="h-9 text-sm text-foreground"
              onChange={(event) => setTitle(event.target.value)}
              disabled={locked}
              autoFocus
            />
          </label>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3">
            <div className={FIELD}>
              {t('workItem.status')}
              {locked ? (
                <span className={`${BOX} bg-muted`}>{state}</span>
              ) : (
                <StatusSelect
                  columns={project?.columns ?? []}
                  value={columnId}
                  onChange={setColumnId}
                  trigger={
                    <button
                      type="button"
                      className={`${BOX} shadow-[inset_0_0_0_1px_var(--input)] outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                    >
                      {state}
                      <ChevronDown className="ms-auto size-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  }
                />
              )}
            </div>
            <div className={FIELD}>
              {t('workItem.source')}
              <span className={`${BOX} bg-muted`}>
                {source?.icon ? (
                  <span className="shrink-0">{source.icon}</span>
                ) : (
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 truncate" dir="auto">
                  {source?.title.trim() || t('untitled')}
                </span>
              </span>
            </div>
          </div>
          {failure && (
            <p role="alert" className="flex items-start gap-2 text-[13px] text-destructive">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              {created ? t('workItem.linkFailed') : t('workItem.failed')}
            </p>
          )}
          <DialogFooter className="mt-1">
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              {t('workItem.cancel')}
            </Button>
            <Button type="submit" disabled={pending || !title.trim() || !columnId}>
              {pending
                ? t('workItem.creating')
                : created
                  ? t('workItem.retryLink')
                  : t('workItem.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
