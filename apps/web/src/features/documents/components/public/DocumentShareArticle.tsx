import { type MouseEvent, useCallback, useMemo } from 'react';
import type { Editor } from '@tiptap/core';
import { useTranslations } from 'next-intl';
import type { SharedDocumentBundle } from '@/lib/api/endpoints/share';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { rewriteSharedLinks, sharedPageOf } from '../../utils/sharedLinks';
import DocumentMarkdownEditor from '../DocumentMarkdownEditor';
import DocumentShareIssues from './DocumentShareIssues';

const noop = () => {};

// One page of a shared document, read only: its title, its content and the work items
// it names. A link to another page of the share opens it in place.
export default function DocumentShareArticle({
  token,
  shared,
  onOpen,
  onOpenIssue,
}: {
  token: string;
  shared: SharedDocumentBundle;
  onOpen: (pageId: number | null) => void;
  onOpenIssue: (issueId: number) => void;
}) {
  const t = useTranslations('documents');
  const relativeTime = useRelativeTime();
  const { document, pages } = shared;
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
    <article onClick={onClick} className="min-w-0 px-[clamp(1rem,4vw,3.5rem)] pt-12 pb-40">
      <h1
        className="flex items-center gap-3 text-[clamp(1.875rem,4vw,2.5rem)] leading-[1.12] font-semibold tracking-[-0.035em] text-balance"
        dir="auto"
      >
        {document.icon && (
          <span className="shrink-0" aria-hidden>
            {document.icon}
          </span>
        )}
        <span className="min-w-0 break-words">{document.title || t('untitled')}</span>
      </h1>
      <p className="mt-2.5 mb-8 text-[13px] text-muted-foreground">
        {t('updated', { time: relativeTime(document.updatedAt) })}
      </p>
      {!document.content.trim() && (
        <p className="text-base text-muted-foreground/70">{t('sharedPageEmpty')}</p>
      )}
      <DocumentMarkdownEditor
        key={document.id}
        defaultValue={document.content}
        defaultJson={document.contentJson}
        editable={false}
        placeholder=""
        onReady={onReady}
        onChange={noop}
        onBlur={noop}
      />
      <DocumentShareIssues
        projectKey={shared.project.key}
        issues={shared.issues}
        onOpen={onOpenIssue}
      />
    </article>
  );
}
