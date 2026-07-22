'use client';

import { useParams, useRouter } from 'next/navigation';
import { useShell } from '@/context/shellContext';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { api } from '@/lib/api';
import { initiativePath, type InitiativeTab } from '@/utils/paths';
import { qk } from '@/services/queryKeys';
import { useInitiativeQuery } from '@/services/initiatives.service';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import InitiativeHeader from './components/detail/InitiativeHeader';
import InitiativeIssuesBoard from './components/detail/InitiativeIssuesBoard';
import InitiativeOverview from './components/detail/InitiativeOverview';

// One initiative: a header of its properties, then an Overview tab and an Issues
// tab (the work items board over its linked issues). Each tab is its own route, so
// the open tab survives a reload; the route that mounts this page passes it.
export default function InitiativeDetailPage({ tab = 'overview' }: { tab?: InitiativeTab }) {
  const { project } = useShell();
  const router = useRouter();
  const params = useParams();
  const raw = Array.isArray(params.initiativeId) ? params.initiativeId[0] : params.initiativeId;
  const initiativeId = raw ? Number(raw) : null;

  const query = useInitiativeQuery(initiativeId);
  const projectKey = project?.project.key ?? '';

  // Poll the initiative's change marker: refetch the initiative (progress/health),
  // its feed, and the board issues when its linked issues or its own fields change.
  useLiveRefresh({
    revKey: ['rev', 'initiative', initiativeId ?? 0],
    fetchRev: () => api.getInitiativeRev(initiativeId!),
    targets: [
      qk.initiative(initiativeId ?? 0),
      qk.initiativeFeed(initiativeId ?? 0),
      qk.boardIssues(projectKey),
    ],
    intervalMs: 12000,
    enabled: initiativeId != null && !!projectKey,
  });

  if (!project || initiativeId == null) return null;

  const initiative = query.data;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!initiative ? (
        <p className="px-6 py-8 text-sm text-muted-foreground">
          {query.isLoading ? 'Loading…' : 'Initiative not found.'}
        </p>
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
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="issues">Issues</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="overview" className="mt-0 flex-1 overflow-y-auto">
              <InitiativeOverview initiative={initiative} project={project} />
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
