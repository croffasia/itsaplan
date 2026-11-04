import Link from 'next/link';
import { FileText } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { IssueDocumentShare } from '@/lib/api/endpoints/share';
import { documentPath } from '@/utils/paths';

// The shared documents whose links also show this issue, in the issue's share dialog.
export default function IssueDocumentSharesNotice({
  projectRef,
  shares,
}: {
  projectRef: string;
  shares: IssueDocumentShare[];
}) {
  const t = useTranslations('common.share');
  const format = useFormatter();
  if (shares.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border px-3 py-2.5">
      <span className="text-sm">{t('throughDocuments')}</span>
      <span className="text-xs text-muted-foreground">{t('throughDocumentsHint')}</span>
      <ul className="mt-1 flex flex-col gap-1">
        {shares.map((share) => (
          <li key={share.documentId} className="flex items-center justify-between gap-3 text-sm">
            <Link
              href={documentPath(projectRef, share.documentId)}
              className="flex min-w-0 items-center gap-1.5 hover:underline"
            >
              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate" dir="auto">
                {share.title}
              </span>
            </Link>
            <span className="shrink-0 text-xs text-muted-foreground">
              {share.expiresAt
                ? t('expiresOn', {
                    date: format.dateTime(new Date(share.expiresAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }),
                  })
                : t('neverExpires')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
