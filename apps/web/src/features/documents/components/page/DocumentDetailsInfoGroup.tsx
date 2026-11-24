import { useTranslations } from 'next-intl';
import type { ProjectDocument } from '@/lib/api/endpoints/documents';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { useShell } from '@/context/shellContext';
import { formatDate } from '@/utils/dates';
import DocumentDetailsGroup from './DocumentDetailsGroup';
import DocumentDetailsValue from './DocumentDetailsValue';

const WORDS_PER_MINUTE = 200;

// When the page was written, by whom, and how long it is.
export default function DocumentDetailsInfoGroup({
  document,
  wordCount,
  open,
  onToggle,
}: {
  document: ProjectDocument;
  wordCount: number;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('documents');
  const relativeTime = useRelativeTime();
  const { project } = useShell();
  const by = (userId: string | null) =>
    t('inspector.by', {
      name:
        project?.assignees.find((assignee) => assignee.userId === userId)?.name ??
        t('unknownAuthor'),
    });
  const sub = (text: string) => <span className="truncate text-muted-foreground">{text}</span>;

  return (
    <DocumentDetailsGroup
      label={t('info')}
      open={open}
      spaced
      onToggle={onToggle}
      rows={[
        [
          t('createdAt'),
          <DocumentDetailsValue key="created" interactive={false}>
            {formatDate(document.createdAt)}
            {sub(by(document.createdByUserId))}
          </DocumentDetailsValue>,
        ],
        [
          t('updatedAt'),
          <DocumentDetailsValue key="updated" interactive={false}>
            {relativeTime(document.updatedAt)}
            {sub(by(document.updatedByUserId))}
          </DocumentDetailsValue>,
        ],
        [
          t('inspector.length'),
          <DocumentDetailsValue key="length" interactive={false}>
            {wordCount ? t('inspector.words', { count: wordCount }) : t('inspector.empty')}
            {wordCount > 0 &&
              sub(t('inspector.readTime', { count: Math.ceil(wordCount / WORDS_PER_MINUTE) }))}
          </DocumentDetailsValue>,
        ],
      ]}
    />
  );
}
