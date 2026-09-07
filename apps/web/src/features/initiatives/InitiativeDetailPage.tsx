'use client';

import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { revScope } from '@/utils/revScopes';
import { initiativePath, type InitiativeTab } from '@/utils/paths';
import { qk } from '@/services/queryKeys';
import { useInitiativeQuery } from '@/services/initiatives.service';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import PageSkeleton from '@/components/common/skeleton/PageSkeleton';
import InitiativeHeader from './components/detail/InitiativeHeader';
import InitiativeIssuesBoard from './components/detail/InitiativeIssuesBoard';
import InitiativeOverview from './components/detail/InitiativeOverview';
import InitiativeProgress from './components/detail/InitiativeProgress';

// One initiative: a header of its properties, then its description (Overview), how
// it is going (Progress) and the work items board over its linked issues (Issues).
// Each tab is its own route, so the open tab survives a reload; the route that
// mounts this page passes it.
export default function InitiativeDetailPage({ tab = 'overview' }: { tab?: InitiativeTab }) {
  const t = useTranslations('initiatives');
  const { project } = useShell();
  const router = useRouter();
  const params = useParams();
  const raw = Array.isArray(params.initiativeId) ? params.initiativeId[0] : params.initiativeId;
  const initiativeId = raw ? Number(raw) : null;

  const query = useInitiativeQuery(initiativeId);
  const projectKey = project?.project.key ?? '';

  // Refetch the initiative (progress/health), its files, its linked Docs, its feed
  // and the board issues when its linked issues or its own fields change.
  useLiveRefresh({
    scope: initiativeId != null ? revScope.initiative(initiativeId) : null,
    targets: [
      qk.initiative(initiativeId ?? 0),
      qk.initiativeAttachments(initiativeId ?? 0),
      qk.initiativeDocumentLinks(projectKey, initiativeId ?? 0),
      qk.initiativeFeed(initiativeId ?? 0),
      qk.boardIssues(projectKey),
    ],
    enabled: !!projectKey,
  });

  if (!project || initiativeId == null) return null;

  const initiative = query.data;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {query.isLoading ? (
        <PageSkeleton className="mx-0 max-w-none px-6 py-8" />
      ) : !initiative ? (
        <p className="px-6 py-8 text-sm text-muted-foreground">{t('notFound')}</p>
      ) : (
        <>
          <InitiativeHeader initiative={initiative} project={project} />
          <Tabs
            value={tab}
            onValueChange={(value) =>
              router.push(initiativePath(projectKey, initiative.id, value as InitiativeTab))
            }
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="px-6 pt-3">
              <TabsList variant="line">
                <TabsTrigger value="overview">{t('detailTabs.overview')}</TabsTrigger>
                <TabsTrigger value="progress">{t('detailTabs.progress')}</TabsTrigger>
                <TabsTrigger value="issues">{t('detailTabs.issues')}</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="overview" className="mt-0 flex-1 overflow-y-auto">
              <InitiativeOverview initiative={initiative} projectKey={projectKey} />
            </TabsContent>
            <TabsContent value="progress" className="mt-0 flex-1 overflow-y-auto">
              <InitiativeProgress initiative={initiative} project={project} />
            </TabsContent>
            <TabsContent value="issues" className="mt-0 flex min-h-0 flex-1 flex-col">
              <InitiativeIssuesBoard initiativeId={initiative.id} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
