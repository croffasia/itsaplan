'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import SectionPageView from '@/components/common/page/SectionPageView';
import PageDateStamp from '@/components/common/page/PageDateStamp';
import { usePermissions } from '@/hooks/usePermissions';
import { useShell } from '@/context/shellContext';
import BraindumpCapture from './components/BraindumpCapture';
import BraindumpDestinations from './components/BraindumpDestinations';
import BraindumpRoutedCard from './components/BraindumpRoutedCard';
import BraindumpStream from './components/BraindumpStream';
import BraindumpVelocityCard from './components/BraindumpVelocityCard';
import BraindumpVoiceCard from './components/BraindumpVoiceCard';
import { useBraindumpCapture } from './hooks/useBraindumpCapture';
import {
  useBraindumpConfigQuery,
  useBraindumpEntriesQuery,
  useBraindumpStatsQuery,
} from './services/braindump.service';

export default function BraindumpPage() {
  const { project } = useShell();
  const { can } = usePermissions();
  const projectKey = project?.project.key ?? '';

  const configQuery = useBraindumpConfigQuery(projectKey);
  const statsQuery = useBraindumpStatsQuery(projectKey);
  const entriesQuery = useBraindumpEntriesQuery(projectKey);
  const capture = useBraindumpCapture(projectKey);

  // The header clock is client-only state, so it stays out of the server render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!project || statsQuery.isLoading || entriesQuery.isLoading) {
    return <Skeleton className="m-6 flex-1" />;
  }
  if (!can('braindump', 'read')) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        You do not have access to Braindump.
      </div>
    );
  }

  const entries = entriesQuery.data ?? [];
  const stats = statsQuery.data ?? {
    routedToday: 0,
    unsorted: 0,
    byDestination: [],
    daily: [],
    total: 0,
    averagePerDay: 0,
  };
  const config = configQuery.data ?? { voice: false, obsidian: false };
  const canCreate = can('braindump', 'create');
  // The list is pinned-first, so the newest recording is not simply the first one
  // carrying audio.
  const lastVoice =
    entries
      .filter((entry) => entry.hasAudio)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;

  return (
    <SectionPageView
      wide
      title="Braindump"
      description="Capture now, sort never. Type or dictate a thought, then file it to your vault, the board, or an agent's schedule."
      actions={
        <PageDateStamp
          updatedAt={
            mounted && entriesQuery.dataUpdatedAt ? new Date(entriesQuery.dataUpdatedAt) : null
          }
        />
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <BraindumpVoiceCard capture={capture} available={config.voice} lastVoice={lastVoice} />
          <BraindumpRoutedCard stats={stats} />
          <BraindumpVelocityCard stats={stats} />
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Quick capture
            </h2>
            <span className="text-xs text-muted-foreground">
              {stats.unsorted} unsorted · filed straight from here
            </span>
          </div>
          <BraindumpCapture capture={capture} voiceAvailable={config.voice} canCreate={canCreate} />
          <BraindumpDestinations
            projectKey={projectKey}
            ready={capture.canSubmit && canCreate}
            obsidianAvailable={config.obsidian}
            onSubmitTo={(destination, extra) => void capture.submitTo(destination, extra)}
          />
        </section>

        <BraindumpStream
          projectKey={projectKey}
          entries={entries}
          obsidianAvailable={config.obsidian}
          canEdit={can('braindump', 'edit')}
          canDelete={can('braindump', 'delete')}
        />
      </div>
    </SectionPageView>
  );
}
