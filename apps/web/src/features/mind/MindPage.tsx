'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import SectionPageView from '@/components/common/page/SectionPageView';
import PageDateStamp from '@/components/common/page/PageDateStamp';
import { usePermissions } from '@/hooks/usePermissions';
import { useShell } from '@/context/shellContext';
import MindAskBar from './components/MindAskBar';
import MindCategoryChips from './components/MindCategoryChips';
import MindCoreCard from './components/MindCoreCard';
import MindFactList from './components/MindFactList';
import MindHealthCard from './components/MindHealthCard';
import MindMostLinkedCard from './components/MindMostLinkedCard';
import MindRecallsCard from './components/MindRecallsCard';
import MindRememberDialog from './components/MindRememberDialog';
import MindTagsCard from './components/MindTagsCard';
import { filterFacts, type MindFilter } from './utils/mind';
import {
  useForgetMindFact,
  useMindFactsQuery,
  useMindOverviewQuery,
  useMindRecallsQuery,
  useRecallMind,
  useRememberFact,
  useStaleMindFactsQuery,
  useUpdateMindFact,
} from './services/mind.service';

// Mirrors STALE_AFTER_DAYS in the API, which decides what counts as stale.
const STALE_AFTER_DAYS = 60;

const EMPTY_OVERVIEW = {
  totalFacts: 0,
  factsThisWeek: 0,
  links: 0,
  recallsToday: 0,
  byCategory: [],
  daily: [],
  mostLinked: [],
  health: { verified: 0, conflicted: 0, stale: 0, orphans: 0 },
};

export default function MindPage() {
  const { project } = useShell();
  const { can } = usePermissions();
  const projectKey = project?.project.key ?? '';

  const [filter, setFilter] = useState<MindFilter>({ type: 'all' });
  const [search, setSearch] = useState('');
  const [remembering, setRemembering] = useState(false);
  const [reviewingStale, setReviewingStale] = useState(false);

  const overviewQuery = useMindOverviewQuery(projectKey);
  const factsQuery = useMindFactsQuery(projectKey);
  const recallsQuery = useMindRecallsQuery(projectKey);
  const staleQuery = useStaleMindFactsQuery(projectKey, reviewingStale);
  const remember = useRememberFact(projectKey);
  const update = useUpdateMindFact(projectKey);
  const forget = useForgetMindFact(projectKey);
  const recall = useRecallMind(projectKey);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const allFacts = useMemo(() => factsQuery.data ?? [], [factsQuery.data]);
  // Reviewing stale facts narrows the whole page to that queue, chips included.
  const source = useMemo(
    () => (reviewingStale ? (staleQuery.data ?? []) : allFacts),
    [reviewingStale, staleQuery.data, allFacts],
  );
  const visible = useMemo(() => filterFacts(source, filter, search), [source, filter, search]);

  if (!project || factsQuery.isLoading || overviewQuery.isLoading) {
    return <Skeleton className="m-6 flex-1" />;
  }
  if (!can('mind', 'read')) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        You do not have access to Mind.
      </div>
    );
  }

  const overview = overviewQuery.data ?? EMPTY_OVERVIEW;
  const canEdit = can('mind', 'edit');
  const canDelete = can('mind', 'delete');

  return (
    <SectionPageView
      wide
      title="Mind"
      description="The operation's memory, in one place. Every agent recalls this before it acts, so nothing is repeated and no rule is forgotten."
      actions={
        <div className="flex items-center gap-3">
          <PageDateStamp
            updatedAt={
              mounted && factsQuery.dataUpdatedAt ? new Date(factsQuery.dataUpdatedAt) : null
            }
          />
          {can('mind', 'create') && (
            <Button type="button" size="sm" onClick={() => setRemembering(true)}>
              <Plus className="size-4" />
              Remember
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        <MindCoreCard overview={overview} />

        <MindAskBar
          search={search}
          onSearchChange={setSearch}
          onAsk={(question) => recall.mutate(question)}
          asking={recall.isPending}
        />

        <MindCategoryChips facts={source} filter={filter} onChange={setFilter} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <MindFactList
            facts={visible}
            hasAnyFact={allFacts.length > 0}
            canEdit={canEdit}
            canDelete={canDelete}
            onTogglePin={(fact) =>
              update.mutate({ factId: fact.id, patch: { pinned: !fact.pinned } })
            }
            onStatus={(fact, status) => update.mutate({ factId: fact.id, patch: { status } })}
            onCategory={(fact, category) => update.mutate({ factId: fact.id, patch: { category } })}
            onForget={(fact) => forget.mutate(fact.id)}
          />

          <aside className="space-y-4">
            <MindMostLinkedCard hubs={overview.mostLinked} />
            <MindRecallsCard recalls={recallsQuery.data ?? []} />
            <MindHealthCard
              health={overview.health}
              staleAfterDays={STALE_AFTER_DAYS}
              reviewingStale={reviewingStale}
              onReviewStale={() => setReviewingStale((current) => !current)}
            />
            <MindTagsCard facts={allFacts} onSelect={setSearch} />
          </aside>
        </div>
      </div>

      <MindRememberDialog
        open={remembering}
        onOpenChange={setRemembering}
        saving={remember.isPending}
        onSubmit={(input) => {
          remember.mutate(input);
          setRemembering(false);
        }}
      />
    </SectionPageView>
  );
}
