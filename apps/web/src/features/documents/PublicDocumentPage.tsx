'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { getSharedDocument, getSharedDocumentIssue } from '@/lib/api/endpoints/share';
import { titlePath, useDocumentTitle } from '@/hooks/useDocumentTitle';
import { IssueRefsProvider } from '@/context/issueRefs';
import PublicShareFrame from '@/components/common/page/PublicShareFrame';
import PublicShareHeader from '@/components/common/page/PublicShareHeader';
import PublicIssueOverlay from '@/features/issue/components/public/PublicIssueOverlay';
import DocumentLoadingState from './components/DocumentLoadingState';
import DocumentShareArticle from './components/DocumentShareArticle';
import DocumentShareTree from './components/DocumentShareTree';
import { parsePageParam, sharedIssueHref, sharedPageHref } from './utils/sharedLinks';

// The public read-only page for a shared document (/share/document/:token). Fetches the
// bundle by token and renders it with no session. A link that includes the subpages
// lists them beside the page, and opening one reads it under the same token. The open
// subpage is in `?page`, so it survives a reload and can be linked to. With linked issues
// shown, an issue the page names opens over it, read under the same token (`?issue`).
export default function PublicDocumentPage({ token }: { token: string }) {
  const t = useTranslations('documents');
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageId = parsePageParam(searchParams.get('page'));
  const issueId = parsePageParam(searchParams.get('issue'));
  const query = useQuery({
    queryKey: ['share', 'document', token, pageId],
    queryFn: () => getSharedDocument(token, pageId ?? undefined),
    retry: false,
    placeholderData: keepPreviousData,
  });
  const shared = query.isError ? undefined : query.data;
  const rootId = shared?.pages[0].id ?? 0;
  const issueRefs = useMemo(
    () => ({
      issues: new Map((shared?.issues ?? []).map((issue) => [issue.sequence, issue])),
      href: (id: number) => sharedIssueHref(token, pageId ?? rootId, rootId, id),
    }),
    [shared?.issues, token, pageId, rootId],
  );
  useDocumentTitle(
    titlePath(shared?.project.name, shared && (shared.document.title || t('untitled'))),
  );

  if (query.isLoading) {
    return (
      <PublicShareFrame>
        <DocumentLoadingState />
      </PublicShareFrame>
    );
  }

  if (!shared) {
    return (
      <PublicShareFrame>
        <p className="px-6 py-10 text-sm text-muted-foreground">{t('shareUnavailable')}</p>
      </PublicShareFrame>
    );
  }

  const open = (id: number | null) => {
    router.push(sharedPageHref(token, id ?? rootId, rootId));
  };

  return (
    <PublicShareFrame>
      <PublicShareHeader name={shared.project.name} ticker={shared.project.key} />
      <div className="flex flex-col md:flex-row">
        {shared.pages.length > 1 && (
          <DocumentShareTree pages={shared.pages} currentId={shared.document.id} onOpen={open} />
        )}
        <IssueRefsProvider
          refs={issueRefs.issues.size > 0 ? [`share.${shared.project.key}`] : []}
          shared={issueRefs}
        >
          <DocumentShareArticle
            token={token}
            document={shared.document}
            pages={shared.pages}
            onOpen={open}
          />
        </IssueRefsProvider>
      </div>
      <PublicIssueOverlay
        queryKey={['share', 'document', token, 'issue']}
        load={(id) => getSharedDocumentIssue(token, id)}
        issueId={issueId}
        extended={false}
        onOpenIssue={(id) => router.push(issueRefs.href(id))}
        onClose={() => router.push(sharedPageHref(token, pageId ?? rootId, rootId))}
      />
    </PublicShareFrame>
  );
}
