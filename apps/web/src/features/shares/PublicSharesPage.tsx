'use client';

import { FileText, LayoutGrid, SquareCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { documentPath, issuePath, viewPath } from '@/utils/paths';
import SectionPageView from '@/components/common/page/SectionPageView';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import PublicSharesSection from './components/PublicSharesSection';
import PublicSharesRevokeAll from './components/PublicSharesRevokeAll';
import { useProjectSharesQuery } from './services/shares.service';

// The project's public links (/:team/:projectKey/public): every issue, saved view and
// document that has a live share link, with its expiry. Each can be revoked here, and
// the header action revokes all of them at once.
export default function PublicSharesPage() {
  const t = useTranslations('common.share');
  const { project } = useShell();
  const projectRef = project?.project.ref ?? '';
  const query = useProjectSharesQuery(projectRef);
  const shares = query.data;
  if (!project) return null;

  const key = project.project.key;
  const total = shares ? shares.issues.length + shares.views.length + shares.documents.length : 0;
  const anyRevocable =
    !!shares &&
    ((shares.canRevoke.issues && shares.issues.length > 0) ||
      (shares.canRevoke.views && shares.views.length > 0) ||
      (shares.canRevoke.documents && shares.documents.length > 0));

  return (
    <SectionPageView
      title={t('overviewTitle')}
      description={t('overviewDescription')}
      actions={anyRevocable && <PublicSharesRevokeAll projectKey={projectRef} />}
    >
      {!shares ? (
        <ListSkeleton rows={4} rowClassName="h-12" />
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">{t('overviewEmpty')}</p>
      ) : (
        <div className="flex flex-col gap-8">
          <PublicSharesSection
            projectKey={projectRef}
            kind="documents"
            title={t('overviewDocuments')}
            icon={FileText}
            canRevoke={shares.canRevoke.documents}
            rows={shares.documents.map((row) => ({
              id: row.id,
              label: row.title,
              href: documentPath(projectRef, row.id),
              details: [
                ...(row.includeChildren ? [t('includeSubpages')] : []),
                ...(row.includeIssues ? [t('includeIssues')] : []),
              ],
              expiresAt: row.expiresAt,
            }))}
          />
          <PublicSharesSection
            projectKey={projectRef}
            kind="issues"
            title={t('overviewIssues')}
            icon={SquareCheck}
            canRevoke={shares.canRevoke.issues}
            rows={shares.issues.map((row) => ({
              id: row.id,
              label: `${key}-${row.sequence} ${row.title}`,
              href: issuePath(projectRef, row.sequence),
              details: row.extended ? [t('fullDetails')] : [],
              expiresAt: row.expiresAt,
            }))}
          />
          <PublicSharesSection
            projectKey={projectRef}
            kind="views"
            title={t('overviewViews')}
            icon={LayoutGrid}
            canRevoke={shares.canRevoke.views}
            rows={shares.views.map((row) => ({
              id: row.id,
              label: row.name,
              href: viewPath(projectRef, row.id),
              details: row.extended ? [t('fullDetails')] : [],
              expiresAt: row.expiresAt,
            }))}
          />
        </div>
      )}
    </SectionPageView>
  );
}
