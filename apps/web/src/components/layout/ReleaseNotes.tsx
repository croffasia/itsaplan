import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { Release } from '@/lib/api';
import { renderMarkdown, sanitizeHtml } from '@/lib/markdown';
import { formatDate } from '@/utils/dates';
import { Badge } from '@/components/ui/badge';

// One release in the updates dialog. Feed notes arrive as rendered HTML, changelog
// notes as markdown; both end up sanitized.
export default function ReleaseNotes({ release, badge }: { release: Release; badge?: string }) {
  const t = useTranslations('updates');
  const html = useMemo(() => {
    const options = { newTabLinks: true };
    return release.notesFormat === 'html'
      ? sanitizeHtml(release.notes, options)
      : renderMarkdown(release.notes, options);
  }, [release.notes, release.notesFormat]);

  return (
    <section className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div className="mb-2 flex items-center gap-2">
        {release.url ? (
          <a
            href={release.url}
            target="_blank"
            rel="noreferrer"
            className="font-semibold hover:underline"
          >
            {release.tag}
          </a>
        ) : (
          <span className="font-semibold">{release.tag}</span>
        )}
        {badge && <Badge variant="secondary">{badge}</Badge>}
        {release.publishedAt && (
          <span className="text-xs text-muted-foreground">{formatDate(release.publishedAt)}</span>
        )}
      </div>
      {html ? (
        <div className="md-content" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="text-sm text-muted-foreground">{t('noNotes')}</p>
      )}
    </section>
  );
}
