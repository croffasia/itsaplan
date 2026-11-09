import { type MouseEvent, useCallback, useMemo } from 'react';
import type { Editor } from '@tiptap/core';
import { useFormatter, useTranslations } from 'next-intl';
import type { SharedDocumentBundle } from '@/lib/api/endpoints/share';
import { cn } from '@/lib/utils';
import { rewriteSharedLinks, sharedPageOf } from '../utils/sharedLinks';
import DocumentMarkdownEditor from './DocumentMarkdownEditor';

const noop = () => {};

// One page of a shared document, read only: its title and its content. A link to another
// page of the share opens it in place.
export default function DocumentShareArticle({
  token,
  document,
  pages,
  onOpen,
}: {
  token: string;
  document: SharedDocumentBundle['document'];
  pages: SharedDocumentBundle['pages'];
  onOpen: (pageId: number | null) => void;
}) {
  const t = useTranslations('documents');
  const format = useFormatter();
  const lockedTitle = t('lockedLink');
  const pageIds = useMemo(() => new Set(pages.map((page) => page.id)), [pages]);
  const rootId = pages[0].id;

  const onReady = useCallback(
    (editor: Editor | null) => {
      if (!editor) return;
      const share = { token, origin: window.location.origin, rootId, pageIds };
      rewriteSharedLinks(editor, share, lockedTitle);
    },
    [token, rootId, pageIds, lockedTitle],
  );

  const onClick = (event: MouseEvent<HTMLElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    // An issue chip opens its issue through the IssueRef extension.
    const link = (event.target as Element).closest?.('a[href]:not(.issue-ref)');
    if (!(link instanceof HTMLAnchorElement)) return;
    const pageId = sharedPageOf(link.href, window.location.origin, token);
    if (pageId === undefined) return;
    event.preventDefault();
    onOpen(pageId);
  };

  return (
    <article
      onClick={onClick}
      className={cn(
        'mx-auto w-full max-w-[860px] min-w-0 px-5 pt-10 pb-24 sm:px-8 md:pt-14 lg:px-14',
        document.fullWidth && 'max-w-[1280px] lg:px-20',
      )}
    >
      <header className="mb-9 border-b border-border/55 pb-8">
        <h1
          className="flex items-start gap-2 text-[2rem] leading-[1.12] font-semibold tracking-[-0.035em] text-balance md:text-[2.5rem]"
          dir="auto"
        >
          {document.icon && <span className="shrink-0">{document.icon}</span>}
          <span className="min-w-0 break-words">{document.title || t('untitled')}</span>
        </h1>
        <p className="mt-3 text-xs text-muted-foreground/80">
          {t('updated', {
            time: format.dateTime(new Date(document.updatedAt), { dateStyle: 'medium' }),
          })}
        </p>
      </header>
      <DocumentMarkdownEditor
        key={document.id}
        defaultValue={document.content}
        defaultJson={document.contentJson}
        editable={false}
        placeholder=""
        className="text-[15px] leading-7 md:text-base md:leading-7"
        onReady={onReady}
        onChange={noop}
        onBlur={noop}
      />
    </article>
  );
}
