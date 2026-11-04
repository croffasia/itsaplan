import { useFormatter, useTranslations } from 'next-intl';
import type { SharedDocumentBundle } from '@/lib/api/endpoints/share';
import { cn } from '@/lib/utils';
import DocumentMarkdownEditor from './DocumentMarkdownEditor';

const noop = () => {};

// One page of a shared document, read only: its title and its content.
export default function DocumentShareArticle({
  document,
}: {
  document: SharedDocumentBundle['document'];
}) {
  const t = useTranslations('documents');
  const format = useFormatter();

  return (
    <article
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
        onReady={noop}
        onChange={noop}
        onBlur={noop}
      />
    </article>
  );
}
